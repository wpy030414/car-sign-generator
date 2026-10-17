# AGENTS.md

机动车号牌生成器：四国（中/欧/美/日）号牌渲染引擎 + React 编辑器 + 4K PNG 导出。数据驱动，标准可追溯。

## 概述

- **本项目是什么**：一个把各国号牌标准（尺寸、字符比例、字体、颜色）落成数据、用 SVG 精确渲染、可导出高清 PNG 的 Web 工具。核心是一套「标准数据模型 + 通用布局引擎 + 通用 SVG 渲染器」，各国差异尽量表达为数据而非新代码。

## 边界与范围

- **范围内**：
  - 中国 GA 36-2018（15 类版式）、欧盟 Reg (EU) 1003/2010、美国 FHWA/AMA 通用物理标准、日本道路運送車両法 番号標。
  - 编辑器（国家/类型/字段 + 校验）、实时预览、4K 导出。
- **非目标（明确排除）**：
  - 不追求像素级复刻受版权保护的官方字体（用开源字体替代）。
  - 不实现各国州别/地区特殊图案底（如美国各州图形、日本彩边摩托小板）。
  - 不做后端、不做用户系统、不做批量生成服务。
  - 不用于任何违法用途（伪造号牌）——见 README 免责声明。

## Agent 操作指南

- **如何理解本项目**：先读 `src/types/standard.ts`（数据模型，一切的地基），再读 `src/lib/plate/layout.ts`（布局引擎），再看 `src/lib/standards/cn.ts`（一个完整的标准数据示例）。渲染入口 `src/components/plates/PlateSvg.tsx`。
- **全局规则 / 约定**：
  - **mm 是唯一长度单位**：所有物理量（尺寸、字符宽高、间距、边距）以 mm 表达，SVG `viewBox` 直接以 mm 为 user unit。不要引入 px 常量到标准数据里。
  - **新增一种版式 = 加一条 `PlateType` 数据**；新增一个国家 = 加一个 `standards/<region>.ts` + 在 `standards/index.ts` 注册（+ 若有特殊几何装饰，加一个组件并注册到 `PlatePreview` 的 `DECORATIONS`）。优先用数据表达，避免新增渲染代码。
  - **字符按固定 mm 单元格摆放**，不依赖字体自然 advance。两种拟合模式：`uniform`（等比，用于 FE-Schrift 等本就按标准设计的字体）、`fill`（各向异性拉伸，用于 Noto 等替代字体）。见 `layout.ts` 的 `glyphTransform`。
  - **字体 ink 度量在构建期生成**（`src/lib/plate/fontMetrics.ts`），不要改成运行时 canvas 测量——保持布局引擎纯函数、可单测。
  - **分隔点「·」用矢量 `<circle>` 绘制**，不用字体字形（Latin.ttf 无 U+00B7），不用外链图片（会污染导出画布）。
  - **导出前必须内联字体 base64**（canvas 栅格化 SVG 时无法访问 document.fonts）。见 `export.ts`，改动导出路径时保持 `assertNoExternalRefs` 守卫。
  - 文档结构见 `docs/`；任何架构性改动同步更新 `docs/DECISIONS.md`。
  - 依赖安装用中国镜像（`.npmrc` 已配 npmmirror）。
  - commit 遵循 Conventional Commits（type/scope 英文，描述中文）。

## 目录速查

- `src/types/standard.ts` — 核心数据模型（Standard/PlateType/CharClass/Run/Decoration）
- `src/lib/standards/{cn,eu,us,jp}.ts` — 四国标准数据（尺寸/字符/颜色/版式）
- `src/lib/standards/index.ts` — 注册表（region↔standard、typeId↔PlateType、字体收集）
- `src/lib/plate/layout.ts` — 布局引擎（run 放置 + glyph ink 拟合 transform）
- `src/lib/plate/fontMetrics.ts` — 构建期字体 ink 度量（生成物，勿手改）
- `src/lib/plate/fonts.ts` — 字体加载（屏幕 @font-face + 导出 base64 内联）
- `src/lib/plate/export.ts` — SVG→Canvas 4K PNG 导出
- `src/lib/plate/fill.ts` — 纯色/渐变 Fill → SVG paint
- `src/lib/plate/validate.ts` — 字段级 + 整串级校验
- `src/components/plates/PlateSvg.tsx` — 通用 SVG 渲染引擎（纯函数）
- `src/components/plates/{EuBand,CnDot}.tsx` — 特殊几何装饰组件
- `src/components/{Editor,PlateStage,PlatePreview,ExportBar}.tsx` — 应用 UI
- `src/store/plateStore.ts` — Zustand 状态 + URL 持久化
- `src/components/ui/` — shadcn/ui 组件（生成物，勿手改）
- `public/fonts/` — 号牌字体（CN.ttf、新能源 CN-E-Latin.otf、FE/Roadgeek/FZ/Noto 等）
- `docs/` — PRD / ARCHITECTURE / DECISIONS / specs
