# 机动车号牌生成器

一个严格按各国标准文件实现的机动车号牌生成器，支持中国、欧盟、美国、日本四套号牌，提供所见即所得编辑器，并可一键导出 4K 高清 PNG。

## 这是什么？

- **定位**：面向字体渲染研究、平面设计、教学演示的号牌可视化工具。用户选择国家/地区与号牌类型，逐字段编辑内容，实时预览按标准 mm 尺寸渲染的号牌矢量图，并导出高分辨率 PNG。
- **解决的核心问题**：旧版为纯原生 HTML/CSS/JS，仅支持中国号牌、靠 CSS `transform: scale()` 拉伸字符（字形失真）、无法导出图片、且引用了会失效的外链图床。新版以 mm 为唯一单位的 SVG 数据驱动引擎重写，标准可追溯、字形精确、支持导出。

## 为什么存在？

- 各国号牌都有明确的标准文件（中国 GA 36-2018、欧盟 Reg (EU) 1003/2010、美国 FHWA/AMA、日本道路運送車両法），但网上多数生成器凭观感近似，尺寸/比例/配色不严谨。
- 本项目把标准里的物理量（尺寸、字符 ink 尺寸、笔画、间距、Pantone 色值）落成数据，渲染时逐字符精确拟合到规定的 mm 单元格，做到「严格参照标准文件」。

## 如何安装和运行？

- **前置要求**：Node.js 24（版本钉在 `.nvmrc`）、vp（Vite+）。
- **首次安装 vp**（macOS / Linux）：
  ```bash
  curl -fsSL https://vite.plus | bash
  . ~/.config/vite-plus/env
  ```
- **安装依赖**：
  ```bash
  vp install
  ```
- **运行 / 启动**：
  ```bash
  vp dev          # 开发服务器（默认 http://localhost:5173）
  vp build        # 生产构建到 dist/
  vp preview      # 预览生产构建
  vp check        # 格式 + lint + 类型（CI 同款）
  vp test run     # 单元测试（Vitest，由 vp 驱动）
  playwright test # 端到端测试（Playwright）
  ```
- **包管理**：`package.json` 不声明 `packageManager`，vp 依据 `pnpm-lock.yaml` 自动检测并代理；网络受限时可在用户级 `~/.npmrc` 配置境内镜像，不提交到仓库。

## 部署

- **线上地址**：<https://wpy030414.github.io/car-sign-generator/>
- **方式**：GitHub Actions（`.github/workflows/deploy.yml`）在推送到 `main` 或手动触发时执行 `vp check`、`vp test run`、`vp build`，经 `upload-pages-artifact` + `deploy-pages` 发布，不推送 `gh-pages` 分支。
- **子路径**：`base` 只由 CI 注入的 `PAGES_BASE_PATH` 决定，代码不对域名或仓库名做任何推断。项目页默认取 `/<repo>/`；用户页或自定义域在 **Settings → Variables → Actions** 把 `PAGES_BASE_PATH` 设为 `/`。
- **本地**：`vp dev` / `vp preview` 恒为根路径，不影响 Playwright。
- **首次启用**：仓库 Settings → Pages → Source 选择 **GitHub Actions**，之后推送即可自动发布。

## 当前状态

- **阶段**：稳定（四国号牌渲染 + 编辑器 + 4K 导出均已实现并通过验证）。
- **已知限制**：
  - 字体：仓库内字体按**使用国家/地区**命名（`CN-Plate` / `EU-Plate` / `US-Plate` / `JP-Plate` 等），原始字体名只作来源说明。美国使用按 FHWA 公有领域字形数据复刻的 Roadgeek 2014 Series EM；欧盟使用 FE-Schrift 系列的 GL-Nummernschild（该字型无官方数字版）；中国与日本字体为训练员提供/开源替代——中美日三国的官方号牌字形均未公开授权（见下）。
  - 日本号牌颜色非法定（法令只规定「营业用绿底白字、自用白底绿字，其余由大臣定」），采用业界实测标准值。
  - 中国新能源号牌为渐变底，渐变节点为近似还原（标准以 Pantone 色号 + 图形附录表述，无精确 hex）。
  - 中国号牌已按 GA 36-2018 各「式样」图逐项实测（单行/双行版式、字符单元格、间隔、分隔点区）。
  - 新能源号牌：大型为「黄底 + 内嵌绿色圆角矩形」，小型为白→绿渐变；分隔处嵌入官方矢量专用标识（Wikimedia Commons「新能源汽车号牌专用标志」，`src/assets/ne-symbol.svg`，以 data URI 内联）。纸质临时号牌的防伪底纹未覆盖。

## 核心技术

- **语言 / 框架**：TypeScript、React 19、Vite 8（Rolldown）。
- **构建 / 检查**：vp（Vite+）统一驱动 `dev` / `build` / `preview` / `check` / `test`。
- **UI**：Tailwind CSS 3.4 + shadcn/ui（Radix UI）。
- **部署**：GitHub Pages 纯静态托管（无服务端、无数据库）。
- **状态**：Zustand（+ URL query 持久化，任意号牌可分享链接）。
- **渲染**：SVG（1 user unit = 1mm，矢量精度）；布局引擎为纯函数，构建期字体 ink 度量，确定性可单测。
- **导出**：SVG 序列化 → 字体 base64 内联 → `Image` → `Canvas`（4K）→ PNG `toBlob` 下载。
- **字体**：

  | 用途                 | 字体文件 / family                    | 说明                                                                          |
  | -------------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
  | 中国 数字/字母/汉字  | `CN-Plate.woff2`（`CN-Plate`）       | 训练员提供的号牌专用字体，等宽字距、字宽约 0.5                                |
  | 中国新能源 字母/数字 | `CN-NE-Latin.woff2`（`CN-NE-Latin`） | 训练员提供的新能源专用字形，`1` 带衬线；缺字形回退 `CN-Plate`                 |
  | 欧盟                 | `EU-Plate.woff2`（`EU-Plate`）       | FE-Schrift 复刻（源 GL-Nummernschild；该字型无官方数字版）；已合并连字符/空格 |
  | 美国                 | `US-Plate.woff2`（`US-Plate`）       | Roadgeek 2014 Series EM（FHWA Series E Modified 字形数据，MIT）               |
  | 日本                 | `JP-Plate.woff2`（`JP-Plate`）       | Noto Sans JP Bold 子集（SIL OFL），替代 TRM/小松書体                          |

  > 字体文件按使用国家/地区前缀命名，原始字体名仅作来源说明。全部字体已子集化为 woff2，
  > 合计约 38KB；子集化脚本见 `scripts/subset-fonts.py`，覆盖清单由单测校验。
  > 拟合方式按版式区分：
  >
  > - **单行版式**（440×140 / 480×140）：`uniform` 等比——字形自然比例映射到单元格，`1` 等窄字保持原宽。
  > - **两行版式**（大型汽车后号牌/挂车 440×220、摩托车 220×140、低速车 300×165）：第一行是「扁字」，按单元格 `fill` 拉伸（图6 上行 80×60、图9 上行 50×50、图19 上行 45×45）。
  >   日本（TRM/小松書体）官方字形未公开授权；欧盟 FE-Schrift 亦从未发布官方数字字体。

## 免责声明

本项目仅供学术研究、字体渲染与设计参考。生成的号牌图像**禁止用于任何商业或违法用途**（含伪造、变造机动车号牌）。使用本项目即表示您了解并愿意承担使用的全部责任。

## 文档

- [docs/PRD.md](docs/PRD.md) — 产品需求与功能意义
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 系统架构与数据流
- [docs/DECISIONS.md](docs/DECISIONS.md) — 关键技术决策记录
- [docs/specs/](docs/specs/) — 各模块规格
- [AGENTS.md](AGENTS.md) — Agent 协作指南
