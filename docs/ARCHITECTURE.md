# ARCHITECTURE — 机动车号牌生成器

## 系统概述

数据驱动架构：**标准数据（PlateType）** → **布局引擎（纯函数）** → **通用 SVG 渲染器** → **导出（SVG→Canvas）**。各国差异尽量表达为数据，仅特殊几何（欧盟星环、中国分隔点）用组件。

```
┌─────────────────────────────────────────────────────────────┐
│  UI 层 (React)                                                │
│  App ──┬── Editor        国家/类型/字段输入 + 校验            │
│        ├── PlateStage ── PlatePreview ── PlateSvg  (渲染)     │
│        │                              └─ EuBand / CnDot (装饰)│
│        └── ExportBar     分辨率选择 + 下载                    │
├─────────────────────────────────────────────────────────────┤
│  状态层  plateStore (Zustand + URL query 持久化)              │
├─────────────────────────────────────────────────────────────┤
│  领域层 (lib/)                                                │
│  standards/  cn·eu·us·jp 数据 + index 注册表                  │
│  plate/      layout(布局) fontMetrics(度量) fonts(加载/内联)  │
│              export(4K) fill(渐变) validate(校验)             │
├─────────────────────────────────────────────────────────────┤
│  类型层  types/standard.ts  (Standard/PlateType/CharClass/…)  │
└─────────────────────────────────────────────────────────────┘
```

**核心不变量：1 SVG user unit = 1mm。** 所有物理量以 mm 表达，`viewBox="0 0 W H"` 直接用号牌 mm 尺寸；屏幕渲染靠 CSS 撑满容器，导出时写入像素尺寸（4K = 3840/长边mm 的比例）。

## 核心模块

| 模块 | 职责 |
|------|------|
| `types/standard.ts` | 数据模型：`Standard`（国家）→ `PlateType`（版式）→ `CharClass`（字符类）/`Run`（序列）/`Decoration`（装饰）/`FieldSpec`（字段）。一切的地基。 |
| `lib/standards/{cn,eu,us,jp}.ts` | 四国标准数据。每个 `PlateType` 含尺寸、边框、字符类（mm ink 尺寸 + 拟合模式）、布局序列、装饰、字段、校验正则、citation。 |
| `lib/standards/index.ts` | 注册表：`STANDARD_BY_REGION`、`TYPE_REGISTRY`、`TYPE_TO_REGION`、`getPlateType`、`fontsOfType`。 |
| `lib/plate/layout.ts` | 布局引擎（纯函数）：`layoutRun`/`layoutFreeRun` 算字符单元格坐标；`glyphTransform` 算 ink→mm 单元格的 SVG transform；支持 `gapAfter`（按字符类型间距）、`shrinkToFit`（超框自动压缩）、三种对齐。 |
| `lib/plate/fontMetrics.ts` | 构建期由 fontTools 测量的字形 ink 度量（em 单位）。**生成物，勿手改。** |
| `lib/plate/fonts.ts` | 字体：屏幕 `@font-face` 注入 + `document.fonts` 加载；导出用 fetch→base64 data URI 缓存。 |
| `lib/plate/export.ts` | 4K 导出：克隆 SVG → 内联 base64 字体 → 序列化 → `Image` → `Canvas` → PNG `toBlob` → 下载。含 `assertNoExternalRefs` 防画布污染。 |
| `lib/plate/fill.ts` | `Fill`（纯色/线性渐变）→ SVG paint + `<linearGradient>` defs；CSS 角度→SVG 渐变向量。 |
| `lib/plate/validate.ts` | 字段级（charset/长度）+ 整串级（pattern，只针对 `primary` 布局序列组成的注册号主串）校验，`sanitizeInput` 输入即时过滤。 |
| `components/plates/PlateSvg.tsx` | 通用 SVG 渲染引擎（纯组件，props = PlateType + values）：板体、边框、装饰、字符序列。同一份 DOM 供预览与导出复用。 |
| `components/plates/EuBand.tsx` | 欧盟蓝带装饰：Reflex Blue 竖带 + 12 星环（Flag of Europe 几何）+ 国别代码（ink 拟合）。 |
| `components/plates/CnDot.tsx` | 中国分隔点装饰：复用 `layoutRun` 按真实布局把 `<circle>` 放在字母/省份与序号之间。 |
| `store/plateStore.ts` | Zustand：region/typeId/values/导出设置；URL 持久化为单个 `?config=<base64url(JSON)>`（debounce replaceState）。 |

## 模块关系

- `PlateType`（数据）是唯一真源，被布局引擎、渲染器、校验、导出共同消费。
- `PlateSvg` 是纯函数：`(PlateType, values) → SVG DOM`，不访问 store，故导出路径可直接序列化预览渲染的同一 DOM。
- 装饰组件通过 `DECORATIONS` 注册表分发（`PlatePreview` 注入），`Decoration.kind='component'` 按 `name` 查找。
- 字体度量（`fontMetrics.ts`）在构建期生成，布局引擎运行时只读，无副作用 → 可在 Node 下单测。

## 数据流

**编辑流**：用户输入 → `Editor` 调 `setField` → store 更新 values → `PlateStage`/`PlatePreview` 重渲染 → `PlateSvg` 调 `layoutRun`/`layoutFreeRun` 算单元格 → `glyphTransform` 算每字符 transform → SVG 更新。同时 store debounce 把整份配置 JSON → base64url 写入 URL `config` 参数（`lib/plate/shareConfig.ts`）。

**导出流**：点「下载 PNG」→ `ExportBar` 读 `svgRef.current` → `exportPlatePng`：克隆 SVG → `buildExportFontCss`（字体转 base64 `@font-face`）注入 `<style>` → 写入目标像素尺寸 → `assertNoExternalRefs` → `XMLSerializer` → `Blob` URL → `Image.decode` → `Canvas.drawImage`（scale = longEdge/max(W,H)）→ `toBlob('image/png')` → `downloadBlob`。

**字体流**：屏幕——`ensureFontsLoaded` 注入 `@font-face`（src=public 路径）+ `document.fonts.load`。导出——`buildExportFontCss` fetch 字体→base64→`@font-face`（src=data URI）内联进 SVG（canvas 栅格化时唯一可靠字体源）。

## 外部系统

- 无后端、无第三方运行时 API。字体文件在 `public/fonts/`，同源加载。
- 标准数据来源：GA 36-2018（中国）与欧盟/美国/日本标准经调研核对，出处见各 `standards/*.ts` 头部注释的 citation。

## 重要技术边界

- **mm 单一真源**：标准数据里不出现 px；导出像素尺寸由 mm × scale 推导。
- **字符 ink 拟合**：标准给的是字符**物理 ink 尺寸**（如中国汽车字符 45×90mm、摩托车序号 30×60mm），字体自然比例与之不符，故用 `glyphTransform` 各向异性（fill）或等比（uniform）缩放 ink box 到精确 mm；连字符、中黒等矮字形改以字体 cap 高为纵向基准，避免被拉成实心块。这是「严格参照标准」的关键，不能退化为 `letter-spacing` 或自然排版。
- **分隔点矢量绘制**：Latin.ttf 无 U+00B7，旧实现用外链 PNG（污染导出画布）。新实现用 `<circle>`。
- **导出字体必须内联**：canvas 栅格化 SVG（经 `Image`）运行在隔离文档，无法访问页面 `document.fonts`；外链字体会失败或跨域污染画布导致 `toBlob` 抛错。故 base64 内联 + `assertNoExternalRefs` 守卫。
- **字体子集化**：CJK 字体原文件 7-10MB，子集化到号牌字符集（中国 44 字、日本 233 字）后 ~14-94KB，可 base64 内联进导出 SVG。
- **布局引擎纯函数**：不依赖 DOM/canvas 测量，构建期度量 + 运行时纯计算 → 确定性、可单测（见 `layout.test.ts`）。
