# Spec — 编辑器与校验

## 要构建什么

- **目标**：让用户直观地选择国家/类型、逐字段编辑号牌内容，实时看到校验反馈与号牌预览，并控制导出参数。取代旧版「整串输入 + 一句『非法的牌号』」的不直观交互。

## 行为

- **编辑器**（`src/components/Editor.tsx`）：
  - 国家/地区：`Tabs`（中/欧/美/日），切换时自动选该国默认类型并重置字段。
  - 号牌类型：`Select`（当前国家全部版式），切换时用该类型默认值填充字段。
  - 字段：每个 `FieldSpec` 一个 `Input`，`onChange` 经 `sanitizeInput` 即时过滤（按 charset 去非法字符 + 截断到 maxLength）；实时显示 `已输入/maxLength` 计数；字段级错误（`validateField`）红框 + 提示。
  - 「填入示例」按钮：一键恢复当前类型默认值。
  - 显示当前类型的 citation（标准出处）。
- **校验**（`src/lib/plate/validate.ts`）：
  - 字段级：`validateField` 检查 minLength/maxLength + charset，返回错误串或 null。
  - 整串级：`buildPlateString` 按字段顺序拼接 → `type.pattern` 正则校验。
  - `validatePlate`：字段级错误优先（有字段错时不查 pattern）；返回 `{ ok, fieldErrors, patternError }`。
  - `sanitizeInput`：输入即时约束（charset 为空串表示不限制，如日本地名汉字）。
- **校验状态展示**（`src/components/PlateStage.tsx`）：预览下方信息条显示物理尺寸（mm）、比例、合法/非法徽章（非法时显示具体原因）。
- **导出控制**（`src/components/ExportBar.tsx`）：分辨率 `Select`（2K/4K/8K）+「下载 PNG」按钮（导出中禁用 + spinner + 错误提示）+ 安装孔开关（`Switch`）。
- **状态持久化**（`src/store/plateStore.ts`）：region/typeId/values 写 URL query（debounce 150ms `replaceState`）；初始化时从 URL 水合，非法值回退默认。

## 输入 / 输出

- **输入**：用户在 Tabs/Select/Input 的操作。
- **输出**：store 状态更新 → 预览重渲染 + URL 同步；导出按钮触发 PNG 下载。

## 约束

- 字段输入必须经 `sanitizeInput` 约束，非法字符不进 store（预防导出缺字/豆腐块）。
- 切换国家/类型时字段重置为该类型默认值（各类型字段集不同，不跨类型复用旧值）。
- URL query 是分享载体，须可水合回完整状态；`typeId` 非法时回退该国默认。
- 校验失败不阻断渲染（仍预览当前内容），只给视觉反馈 —— 便于用户边改边看。

## 边界条件

- 字段清空：整串 pattern 失败 → 徽章显示「不符合…格式」。
- 字段值过短（如序号 2 位）：pattern 失败，徽章提示；渲染仍画出已有字符。
- URL 带非法 typeId/values：回退默认，不崩溃。
- 日本地名（charset 为空）：不限制字符，允许任意汉字（受子集覆盖限制，生僻字导出可能缺字形）。
- 自由文本类型（欧盟通用/美国）：shrinkToFit 处理超长（见布局引擎 spec）。

## 验收标准

- [x] 默认进入中国小型汽车号牌，字段可编辑，预览实时刷新。
- [x] 切换国家 Tab（欧/美/日）自动切到该国默认类型并重渲染。
- [x] 切换类型 Select（如欧盟德→法）正确换版式。
- [x] 非法省份（清空）→ 徽章「不符合小型汽车号牌格式」；合法 → 「合法号牌」。
- [x] 输入即时过滤非法字符（serial 填 `0a*0001XX` → `00001`）。
- [x] 导出按钮触发真实浏览器下载（Playwright download 事件，文件名含尺寸）。
- [x] 安装孔开关生效（关 → 预览无孔）。
- [x] URL 持久化：带 query 的链接可还原对应号牌。

## 完成定义

- 如何判定已完成：Playwright 端到端脚本验证编辑/切换/校验/导出/开关全流程（见 render-export spec 的验收）；`validate.test.ts` 单测覆盖字段级 + 整串级 + sanitize 全绿。
