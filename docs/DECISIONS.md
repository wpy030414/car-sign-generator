# DECISIONS

## ADR-001：用 SVG（mm 坐标系）渲染，而非 Canvas 或 CSS

- **日期**：2026-10
- **状态**：已采纳
- **背景**：旧版用 CSS `transform: scale()` 拉伸字符模拟号牌字体，字形比例失真、难维护、无法高质量导出。需要一种能精确表达「mm 物理尺寸」且可导出高清图的渲染方式。
- **考虑过的方案**：
  1. 继续 CSS + DOM，导出用 html2canvas。
  2. Canvas 2D 直接绘制（预览 + 导出同一套绘制代码）。
  3. SVG 矢量渲染（1 user unit = 1mm），导出时序列化 → Canvas 栅格化。
- **决策**：选方案 3（SVG）。
- **为什么选这个**：
  - SVG `viewBox` 天然以 mm 为 user unit，标准里的物理量直接落图，无单位换算。
  - 矢量缩放无损，预览响应式（CSS 撑满容器）与导出（写入像素尺寸）共用同一份 DOM。
  - 纯 SVG 元素可被 `XMLSerializer` 序列化，导出路径无需重写绘制逻辑。
- **为什么不选其他**：
  - 方案 1：html2canvas 对字体/变换支持差，导出质量不可控，且 CSS 拉伸本身失真。
  - 方案 2：Canvas 预览需要自己处理响应式缩放与 DOM 交互；且 Canvas 栅格化 SVG 时字体问题（见 ADR-004）依然存在，不如直接用 SVG 做预览。
- **后果**：导出需处理「SVG-as-image 字体内联」问题（ADR-004）；渲染器必须是纯 SVG 元素（不能混用 HTML）。
- **何时重新审视**：若未来需要 WebGL 级特效或超大批量服务端渲染，再评估 Canvas/Skia 方案。

## ADR-002：字符按固定 mm 单元格 + ink 拟合摆放，而非字体自然排版

- **日期**：2026-10
- **状态**：已采纳
- **背景**：各国标准规定的是字符的**物理 ink 尺寸**（如中国 GA 36-2018 表3：数字 45×70mm、笔画 10mm；欧盟 FE-Schrift：数字 44.5×75mm）。字体的自然 advance/ink 比例与标准不符（中国 ChePaiZiTi 数字 ink 比例 0.565，标准 45/70=0.643；美国 Overpass 数字 ink 比例 0.72，标准压缩模具 ≈0.41）。若用自然排版或 `letter-spacing`，字符比例会失真。
- **考虑过的方案**：
  1. 用 `font-size` + `letter-spacing` 自然排版，近似标准。
  2. 每字符用 CSS/SVG `transform: scale()` 拉伸到标准尺寸（旧版做法，但基于估算比例）。
  3. 构建期测量字体真实 ink bbox，运行时按「各向异性/等比缩放 ink box → 标准 mm 单元格」精确拟合。
- **决策**：选方案 3。提供两种拟合模式：`fill`（各向异性拉伸 ink 到精确 width×height，用于替代字体）与 `uniform`（等比缩放到标准高度、保留自然宽比，用于本就按标准设计的字体如 FE-Schrift）。
- **为什么选这个**：
  - 精确：ink 尺寸严格等于标准规定值，比例/笔画可追溯。
  - 确定性：度量在构建期由 fontTools 生成（`fontMetrics.ts`），布局引擎是纯函数，无需运行时 canvas 测量，可在 Node 下单测。
  - 实证：FE-Schrift 克隆字体数字 ink 比例 356/600=0.593 与标准 44.5/75=0.593 **完全一致**，验证了 uniform 模式对「按标准设计的字体」的正确性。
- **为什么不选其他**：
  - 方案 1：自然排版无法让 ink 精确等于标准 mm，比例失真（旧版根本问题）。
  - 方案 2：基于估算比例的 scale 不精确，且旧版用 CSS 难以维护。
- **后果**：需要构建期字体度量管线（fontTools）；度量文件是生成物。新增字体需在 `METRICS_BY_FAMILY` 注册。
- **何时重新审视**：若标准给出的是「字体 em 尺寸」而非「ink 尺寸」，或字体本身已按标准设计（则 uniform 足够），可简化。

## ADR-003：数据驱动的标准模型，各国差异尽量表达为数据

- **日期**：2026-10
- **状态**：已采纳
- **背景**：需支持四国、数十种版式。若每种版式写一个组件，代码爆炸且难维护。
- **考虑过的方案**：
  1. 每国/每版式一个渲染组件。
  2. 统一 `PlateType` 数据模型 + 通用渲染器；仅特殊几何用组件。
- **决策**：选方案 2。`Standard → PlateType → CharClass/Run/Decoration` 数据模型；通用 `PlateSvg` 渲染器；欧盟星环、中国分隔点用装饰组件（经 `DECORATIONS` 注册表分发）。
- **为什么选这个**：新增一种版式 = 加一条数据对象；新增一个国家 = 加数据文件 + 注册（+ 必要时一个装饰组件）。90% 的版式差异（尺寸/颜色/字符布局/字段）是数据，不是代码。
- **为什么不选其他**：方案 1 组合爆炸，且各国渲染逻辑大量重复。
- **后果**：数据模型需足够表达力（`Run` 支持静态槽位 `run` 与自由文本 `free`；`Decoration` 支持 rect/circle/screws/component；`CharClass` 支持 `gapAfter`/`shrinkToFit`/两种 fit）。极端版式（如双行欧盟、异形摩托）可能需要新装饰组件或模型扩展。
- **何时重新审视**：当大量版式需要 `component` 装饰（数据模型表达力不足）时，考虑引入更声明式的布局 DSL。

## ADR-004：导出时把字体 base64 内联进 SVG

- **日期**：2026-10
- **状态**：已采纳
- **背景**：4K 导出走 SVG→`Image`→`Canvas`→PNG。Canvas 栅格化 SVG（经 `new Image()`）运行在隔离文档，**无法访问页面的 `document.fonts`**；任何外链字体要么加载失败（豆腐块/回退字形），要么跨域污染画布导致 `toBlob` 抛 `SecurityError`。
- **考虑过的方案**：
  1. 直接用 Canvas 2D `ctx.fillText` 绘制（ctx 能访问 document.fonts），放弃 SVG 导出。
  2. SVG 内联字体 base64 data URI 后栅格化。
  3. 服务端渲染（Puppeteer/Resvg）。
- **决策**：选方案 2。导出前克隆 SVG，把用到的字体 fetch→base64→`@font-face`（src=data URI）注入 SVG `<style>`，再序列化栅格化。
- **为什么选这个**：
  - 与 ADR-001 一致：预览与导出共用同一份 SVG DOM，无需重写绘制逻辑。
  - 全程 data:/blob: 同源 URL，不污染画布。
  - 字体已子集化（ADR-005），base64 体积小，内联可行。
  - 实测验证：四国导出均生成有效 PNG（3840px 长边，正确 mm 比例），字形正确（非豆腐块）。
- **为什么不选其他**：
  - 方案 1：需为导出重写一套 Canvas 绘制代码，与 SVG 预览双轨维护，易不一致。
  - 方案 3：引入后端/重依赖，违背纯前端定位。
- **后果**：导出前必须 `await document.fonts.ready`；需 `assertNoExternalRefs` 守卫（确保无外链 url/image）；字体必须子集化以控制 SVG 体积。Safari 对 SVG 内 `@font-face` 支持历史上不稳定，如出问题可回退方案 1（直接 Canvas 绘制）作为 fallback。
- **何时重新审视**：若 Safari 导出字体失败率高，实现 Canvas 直绘 fallback；若字体子集化无法满足大字符集，评估服务端渲染。

## ADR-005：字体子集化到号牌字符集

- **日期**：2026-10
- **状态**：已采纳
- **背景**：CJK 字体原文件巨大（Source Han Sans CN 7.5MB、Noto Sans JP 9.6MB），无法 base64 内联进每次导出的 SVG。而号牌用字是**封闭集**：中国省份简称 31 个 + 固定尾缀（使领馆学警港澳挂应急等）；日本假名 + 地名汉字 + 数字。
- **考虑过的方案**：
  1. 内联完整字体。
  2. 构建期用 fontTools/pyftsubset 子集化到号牌字符集。
  3. 运行时动态子集化（subset-font wasm）。
- **决策**：选方案 2。用 fontTools 在构建期子集化：中国汉字 44 字（14KB）、日本 233 字（94KB）、欧盟/美国拉丁字符集（16-18KB）。子集文件放 `public/fonts/`，运行时 fetch→base64 内联。
- **为什么选这个**：号牌用字封闭且少，子集化后体积可忽略（全部字体共 ~156KB），base64 内联进导出 SVG 完全可行。构建期子集化简单、确定、无运行时 wasm 依赖。
- **为什么不选其他**：
  - 方案 1：7-10MB base64 ≈ 10-14MB 每次导出，不可接受。
  - 方案 3：运行时 wasm 子集化增加复杂度与首屏开销，而字符集固定无需动态。
- **后果**：新增字符（如新省份、新地名）需重新子集化。子集化脚本用 fontTools（Python），在构建/发布时运行。日本地名汉字集有限（覆盖主要运输支局），生僻地名可能缺字（回退系统字体）。
- **何时重新审视**：若需支持任意用户输入汉字（如自定义地名），改为运行时动态子集化或扩大字符集。

## ADR-006：开源字体替代受版权保护的官方号牌字体

- **日期**：2026-10
- **状态**：已采纳
- **背景**：各国官方号牌字体受版权保护：欧盟 FE-Schrift、美国 Highway Gothic/FHWA Series E、日本 TRM gothic/小松書体，均非自由许可，无法合法内嵌分发。
- **考虑过的方案**：
  1. 使用官方字体（法律风险）。
  2. 用开源近似字体替代，并在 README/代码注明差异。
- **决策**：选方案 2。
  - 欧盟：GL-Nummernschild-Mtl（FE-Schrift 克隆，Gutenberg Labo 自由软件许可）。
  - 美国：Overpass Bold（Red Hat 对 Highway Gothic 的 OFL 重绘）。
  - 日本：Noto Sans JP Bold（OFL）。
  - 中国：ChePaiZiTi（仓库自带的车牌字体）+ Source Han Sans CN（OFL）。
- **为什么选这个**：合法可分发内嵌；Overpass 是 Highway Gothic 的正规开源重绘，GL-Nummernschild 是 FE-Schrift 的精确克隆（ink 比例与标准一致，见 ADR-002），保真度高。
- **为什么不选其他**：方案 1 有明确法律风险，违背开源项目定位。
- **后果**：字形与真牌存在细微差异（尤其日本 TRM 数字的 2:1 压缩比例、小松書体假名）。README 已注明。`fill` 拟合模式可把替代字体压到标准 ink 尺寸，缓解比例差异。
- **何时重新审视**：若获得官方字体授权，或出现更精确的开源克隆，可替换。

## ADR-007：Zustand + URL query 持久化状态

- **日期**：2026-10
- **状态**：已采纳
- **背景**：号牌随每次击键重渲染；需要编辑器与预览独立更新，且配置可分享。
- **考虑过的方案**：
  1. React Context。
  2. Zustand。
- **决策**：选 Zustand，配 URL query 持久化（region/type/values 写进 query string，debounce replaceState）。
- **为什么选这个**：Context 在任何值变化时重渲染所有消费者；Zustand 的按键选择器让编辑面板与号牌预览独立更新。~1KB，无 Provider 嵌套。URL 持久化让任意号牌成为可分享链接。
- **为什么不选其他**：方案 1 重渲染范围大、性能差；引入 Redux 过重。
- **后果**：需手写 ~30 行 URL 同步中间件（或可用 nuqs）。store 是领域状态的单一真源，`Standard` 数据是模块级静态注册表（不可变，非状态）。
- **何时重新审视**：若状态逻辑复杂化（撤销/重做、多号牌对比），评估 zustand middleware 或迁移到更强状态库。
