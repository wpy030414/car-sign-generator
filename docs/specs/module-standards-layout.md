# Spec — 标准数据模型与布局引擎

## 要构建什么

- **目标**：用一套统一的数据模型（`Standard → PlateType → CharClass/Run/Decoration`）表达四国全部号牌版式；用一个纯函数布局引擎把「标准 mm 尺寸 + 用户输入」计算成「每个字形的 SVG 位置与变换」。

## 行为

- **数据模型**（`src/types/standard.ts`）：
  - 所有物理量以 mm（`Mm = number`）表达，SVG viewBox 直接以 mm 为 user unit。
  - `PlateType` 描述一种完整可渲染版式：尺寸、板体填充（纯色/渐变）、边框、字符类集合、布局序列、装饰、可编辑字段、默认值、校验正则、citation。
  - `CharClass` 描述一类字符的物理规格：ink 高/宽、advance、`gapAfter`、拟合模式（`uniform`/`fill`）、颜色、字体。
  - `Run` 有两种：`CharacterRun`（静态槽位，绑定字段第 N 字符或固定字面量）与 `FreeRun`（自由文本，逐字符按数字/字母/其他自动分类）。
- **布局引擎**（`src/lib/plate/layout.ts`）：
  - `layoutRun`：按 `advance + gapAfter`（或 `run.gap`）累加字符单元格 x 坐标；`align:center` 时整体相对牌面中线居中（末尾不留 gap）。字段值不足的槽位返回 `null`（留空）。
  - `layoutFreeRun`：把字段整体展开为字符序列，逐字符选 charClass；支持 left/center/right 对齐 + `width` 对齐框；`shrinkToFit` 时内容超框则按比例压缩 pitch/gap 恰好填满。
  - `glyphTransform`：以 fontSize=1（em 基准）绘制字符，用 `translate + scale(sx,sy)` 把 ink box 精确拟合到 mm 单元格。`fill` 模式各向异性拉伸到 width×height；`uniform` 模式等比缩放到 height、在 advance 内水平居中。y 轴翻转（字体 y-up → SVG y-down）。
  - 度量来自 `fontMetrics.ts`（构建期 fontTools 测量），引擎本身无 DOM/canvas 依赖。

## 输入 / 输出

- **输入**：`PlateType`（标准数据）+ `values: Record<string,string>`（用户字段值）。
- **输出**：
  - 布局：`(PlacedGlyph | null)[]`，每个含 `char`、`cls`、`cell{x,y,w,h}`（mm）。
  - 变换：`{ transform: string; fontSize: number }`，供 SVG `<text>` 使用。

## 约束

- 标准数据里不得出现 px 常量；一切以 mm 表达。
- 布局引擎必须是纯函数（无副作用、无 DOM/canvas 访问），可在 Node 下单测。
- 新增字体必须在 `METRICS_BY_FAMILY` 注册，否则 `metricsFor` 抛错。
- 分隔点「·」不用字体字形（号牌字体无 U+00B7），由 `CnDot` 组件矢量绘制。

## 边界条件

- 字段值为空/过短：对应槽位返回 `null`，渲染跳过（不画空字符）。
- 自由文本超框：`shrinkToFit=true` 时压缩；否则可能溢出（由 maxLength 约束预防）。
- 无 ink 字形（空格）：`glyphTransform` 仅定位不缩放。
- 缺字形（子集外字符）：回退到 advance-only 度量，渲染为系统回退字形（视觉上可察觉，但不崩溃）。

## 验收标准

- [x] 中国 20 类、欧盟 5 类、美国 5 类、日本 6 类版式数据齐全，每类带 citation/fields/defaults。
- [x] `layoutRun` 步进 = advance + gapAfter；居中时左右留白对称（容差 0.5mm）。
- [x] `layoutFreeRun` 右对齐时序列右缘贴合对齐框右缘；shrinkToFit 时超框内容压缩到框宽。
- [x] `glyphTransform` fill 模式使 ink 高精确等于单元格高（数字 0：sy × inkH_ratio = 90mm）。
- [x] 每个 run 引用的 charClass 都存在于 type.charClasses。
- [x] 单元测试 28 项、端到端测试 27 项全过。

## 完成定义

- 如何判定已完成：`vp test run` 全绿；四国各版式经 Playwright 截图验证字符位置/比例正确（见 ARCHITECTURE 数据流）；新增版式只需加数据、无需改渲染代码。
