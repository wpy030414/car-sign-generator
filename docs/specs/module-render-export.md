# Spec — SVG 渲染与 4K 导出

## 要构建什么

- **目标**：把 `PlateType` + 用户输入渲染成精确的 SVG 号牌（预览），并从同一份 SVG 导出 4K（可选 2K/8K）高清 PNG，字体字形在导出图中与屏幕预览一致。

## 行为

- **通用渲染器**（`src/components/plates/PlateSvg.tsx`）：
  - 纯组件，props = `{ type, values, componentDecorations, showScrews, svgRef }`，不访问 store。
  - `<svg viewBox="0 0 W H">`（W/H = 号牌 mm 尺寸），**屏幕渲染时不设 width/height 属性**，由 CSS `width:100%` + `preserveAspectRatio` 自适应容器。
  - 依次绘制：板体 `<rect>`（含 rx 圆角、纯色/渐变填充）→ 边框（内缩描边，width=0 时不画；`border.inset` >0 时边框外侧再留一圈板体底色，GA 36 为 3mm 底色 + 2mm 白边）→ 装饰（rect/circle/screws/component）→ 字符序列（每个 `<text>` 带 `glyphTransform` 算出的 transform）。
  - 渐变经 `fill.ts` 生成 `<linearGradient>` defs，ID 用 `useId()` 保证全页唯一（多牌同屏不冲突）。
  - 特殊几何装饰经 `componentDecorations` 注册表分发（欧盟 `eu-band`、中国 `cn-dot`）。
- **字体加载**（`src/lib/plate/fonts.ts`）：
  - 屏幕：`ensureFontsLoaded` 动态注入 `@font-face`（src = public 路径）+ `document.fonts.load` 触发；幂等（同 family 只注入一次）。
  - 导出：`buildExportFontCss` 把字体 fetch→base64→`@font-face`（src = data URI），按 family 去重、带缓存。
- **导出**（`src/lib/plate/export.ts`）：
  1. `await document.fonts.ready`。
  2. 克隆预览 SVG（不触碰 UI DOM）。
  3. 注入 base64 `@font-face` 到克隆体 `<style>`（置于首个子节点）。
  4. 写入目标像素尺寸：`scale = longEdge / max(wMm, hMm)`，`width = round(wMm×scale)`。
  5. `assertNoExternalRefs`：所有 `url(...)` 必须是 `data:` 或 `#fragment`；`<image href>` 必须是 `data:`。否则抛错（防画布污染）。
  6. `XMLSerializer` 序列化 → `Blob` → `URL.createObjectURL`。
  7. `new Image()` + `decoding='sync'` → `onload` → `Canvas.drawImage(img,0,0,W,H)`。
  8. `canvas.toBlob('image/png')` → `<a download>` 点击下载 → 释放 object URL。

## 输入 / 输出

- **输入**：已挂载的预览 `<svg>` 元素、`PlateType`、该类型用到的 `FontRef[]`、导出选项（longEdge、filename、background）。
- **输出**：PNG `Blob`（导出函数）；浏览器下载文件（一站式函数），命名 `<typeId>-<longEdge>px.png`。

## 约束

- 导出 SVG 内**不得有任何外部引用**（字体、图片、CSS）—— 必须全部 data URI 或内部 fragment。
- 栅格化前必须写入显式 `width`/`height`（仅有 viewBox 的 SVG 在部分浏览器栅格化为 0×0 或 300×150 默认值）。
- 序列化用 `XMLSerializer`（正确转义 `& < >`）；用 `Blob` URL 而非 data URL（避免 2MB data-URL 上限，也免去手工 encodeURIComponent）。
- 字体必须已子集化（见 ADR-005），否则 base64 体积不可接受。
- 全程 data:/blob: 同源 → 画布不被污染，`toBlob` 不抛 SecurityError。

## 边界条件

- 字体加载失败：屏幕渲染回退到系统字体（视觉可察觉但不崩）；导出时 base64 内联仍用原字体文件，故导出字形正确。
- 字体缺字形（子集外字符）：导出图渲染为回退字形/豆腐块 —— 由字段 charset 约束预防。
- 白色/透明号牌：预览容器用棋盘格背景以便观察边界；导出默认透明背景，可选 `background` 填充。
- 极端长宽比（日本大板 440×220、欧盟 520×110）：longEdge 固定长边，短边按比例缩小。
- 8K 导出（7680px）：Canvas 内存约为 4K 的 4 倍，仍可行；更大尺寸未测试。

## 验收标准

- [x] 四国各版式屏幕预览渲染正确（Playwright 截图逐一核对：中国 7 类、欧盟 2 类、美国 2 类、日本 2 类）。
- [x] 四国 4K 导出均生成有效 PNG，长边恰为 3840px，宽高比等于号牌 mm 比例（中国 3.14、欧盟 4.73、美日 2.0）。
- [x] 导出图字形与屏幕预览一致（中国 ChePaiZiTi 数字 + Source Han Sans 汉字、欧盟 FE-Schrift、美国 Roadgeek、日本 Noto Sans JP 均正确嵌入，无豆腐块）。
- [x] 导出无画布污染错误（`toBlob` 成功返回）。
- [x] UI 中点击「下载 PNG」实际触发浏览器下载（Playwright download 事件验证，文件名 `cn-small-car-3840px.png`）。
- [x] 分辨率可选 2K/4K/8K；安装孔可开关（关闭后导出干净图样）。

## 完成定义

- 如何判定已完成：`pnpm build` 通过；Playwright 端到端验证四国预览 + 4K 导出（含实际下载文件校验尺寸）；导出图经人工目视确认字形正确、边缘清晰无锯齿。
