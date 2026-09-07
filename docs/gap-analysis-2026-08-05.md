# PromptStudio 功能差距分析（Gap Analysis）

> 日期：2026-08-05 ｜ 分析人：产品经理 Alice
> 基准文档：`PromptStudio-模块功能说明.md`（主基准）、`PRD-PromptStudio-集成式Prompt编辑应用.md`（补充 P1/P2 项）
> 本报告仅做分析，未修改任何代码文件。

---

## 1. 主实现结论

**当前生效的主实现是 `src/` 下的 React 18 + TS 版（Vite 构建）。**

依据：
- `index.html` 唯一的脚本引用是 `<script type="module" src="/src/main.tsx">`，未引用任何 `css/`、`js/` 原生文件；
- `package.json` scripts 为 `vite` / `tsc -b && vite build`，依赖含 react、zustand、codemirror、dexie；
- `vite.config.ts` 配置了 `@vitejs/plugin-react` 与 `@ → src` 别名。

根目录的 `js/`（15 个原生 JS 文件）与 `css/`（10 个文件）是**旧版原生实现**，由 `promptstudio.html` 使用，不被 `index.html` 引用，属遗留代码（模块说明第 9 章标注的 `/js/selection-toolbar.js` 即属此列）。`promptstudio-app.html` 为单文件原型，按要求不在本次范围内。

**注意**：模块说明文档中个别功能（如划词工具栏四操作）只在旧版 `js/` 中存在，src 版并未移植——这类功能按"未实现/部分实现"计入差距。

---

## 2. 差距清单总表

| # | 模块 | 功能点 | 文档出处 | 实现状态 | 证据 | 优先级 |
|---|------|--------|----------|----------|------|--------|
| 1 | 编辑器 | Markdown/YAML 编辑、行号、高亮、折叠 | 模块说明 1 | ✅ | `CodeEditor.tsx`（CM6 + lang-markdown + foldGutter） | — |
| 2 | 编辑器 | 实时校验防抖 500ms | 模块说明 1 | ✅ | `useStore.ts` `setDocContent` debounce 500ms | — |
| 3 | 编辑器 | **行内波浪线（双通道之一）** | 模块说明 1；PRD 5.1 验收 | ❌ | `CodeEditor.tsx` `createLinter()` 定义但**从未被调用**，`lintConf` 只装了 `lintGutter()` 没装 `linter()`，且 issue 行号→位置映射未实现（from/to 硬编码 0） | **P0** |
| 4 | 编辑器 | **校验面板点击跳转定位到行** | 模块说明 1；PRD 5.1 验收 | ❌ | `ValidationPanel.tsx` L58 onClick 为空注释 "Could scroll to line" | **P0** |
| 5 | 编辑器 | 一键自动整理 | 模块说明 1 | 🟡 | `doAutoOrganize` + TopBar 按钮已有，但**未生成版本快照**（说明要求"应用后生成新版本快照"），也无 PRD 要求的"排序预览→确认"流程 | P1 |
| 6 | 编辑器 | 错误状态黄色横幅 | 模块说明 1 | ✅ | `TopBar.tsx` `validation-banner` | — |
| 7 | 编辑器 | Tab / Shift+Tab 缩进快捷键 | 模块说明 1 | ❌ | `CodeEditor.tsx` keymap 仅 `defaultKeymap + historyKeymap`，未加 `indentWithTab` | P2 |
| 8 | 规则校验 | 内置 4 套规则集 | 模块说明 2；PRD 5.1 | 🟡 | `rulesets.ts` 仅 3 套（anthropic-skill / generic-prompt / openai-function），缺"自定义"模板 | P1 |
| 9 | 规则校验 | **规则集切换** | PRD 5.1「可切换」 | ❌ | `TopBar.tsx` L34 `<select onChange={() => {}}>`——**切换是空函数，当前永远用 anthropic-skill** | **P0** |
| 10 | 规则校验 | 结构规则：禁止字段（forbid frontmatter 字段） | 模块说明 2 | ❌ | `validation.ts` 仅有 require-frontmatter / require-module / forbid-module，无 forbid-field 类型 | P1 |
| 11 | 规则校验 | 结构规则：未知模块告警 | 模块说明 2 | ❌ | `validate()` 无未知模块检测逻辑 | P1 |
| 12 | 规则校验 | 格式规则：YAML frontmatter 合法性 | 模块说明 2 | 🟡 | `parseFrontmatter` 是朴素正则解析，不做 YAML 语法合法性校验（已装 `@codemirror/lang-yaml` 未用于校验） | P1 |
| 13 | 规则校验 | 风格规则：祈使句（imperative-verbs） | 模块说明 2 | ❌ | `rulesets.ts` 声明了 `imperative-verbs`，但 `validation.ts` 未实现该类型（person-consistency 只覆盖"你应该/你可以"启发式） | P1 |
| 14 | 规则校验 | 模块顺序检测 / 自动整理算法 | 模块说明 2 | ✅ | `validation.ts` orderRules 检测 + `autoOrganize` | — |
| 15 | 规则校验 | **导入规范文档提炼为规则集** | 模块说明 2「规则集扩展」；PRD 5.1 亮点、5.9 | ❌ | 全 src 无相关代码（无拖拽入口、无提炼流程、无规则集 CRUD） | P1 |
| 16 | AI 对话 | 流式输出 / Markdown 渲染 / 代码块复制 / 中断生成 | 模块说明 3 | ✅ | `adapter.ts` SSE + `AbortController`；`ChatPanel.tsx` 停止按钮、codeblock-copy | — |
| 17 | AI 对话 | Reasoning 折叠（默认 100 字符摘要） | 模块说明 3 | ✅ | `ChatPanel.tsx` reasoning-block（展开/折叠 + slice(0,100)）；adapter 支持 reasoning_content / thinking_delta | — |
| 18 | AI 对话 | 上下文自动注入（文档+规则集+迭代摘要） | 模块说明 3 | 🟡 | `buildContextMessages` 有全文+规则+上轮迭代摘要；但**增量模式的"选中区块"链路断了**：`setSelectedText` 在全工程中从未被调用（`CodeEditor` 只 set 了 chatReference），增量模式永远退化为文档前 500 字符 | **P0** |
| 19 | AI 对话 | 全文/增量模式切换 | 模块说明 3 | ✅（UI）/🟡（实际效果随 #18 打折） | `ChatPanel.tsx` context-bar | P0（随 #18） |
| 20 | AI 对话 | 系统级修改人设 Prompt | 模块说明 3 | ✅ | `DEFAULT_SYSTEM_PROMPT`（PRD 要求"可配置"，当前写死，可配置性列入 P2） | — |
| 21 | AI 对话 | 应用为候选修改 + 五层降级提取 | 模块说明 3 | ✅ | `applyAsCandidate` + `extractDocumentFromResponse` 五策略 + 嵌套 fence 行级解析 | — |
| 22 | AI 对话 | 对话持久化（Dexie，按文档维度） | 模块说明 3 | ✅（恢复）/🟡（清空） | `saveChatSession`/`getChatSession` 正常；但**"清空对话"只清内存 state 不清 Dexie**，刷新后旧对话复活 | P2 |
| 23 | AI 对话 | 多模型（8 家供应商） | 模块说明 3 | 🟡 | `providers.ts` 仅 DeepSeek/OpenAI/Anthropic + 自定义（4/8）。缺 Gemini、Moonshot、通义千问、Ollama、OpenRouter。PRD 里程碑为 M1 三家→M2 八家，按模块说明口径记部分实现 | P1 |
| 24 | AI 对话 | 模型快速切换 / 清空对话 / 成本展示 | 模块说明 3 | ✅ | `ChatPanel.tsx` model-dropdown、↺ 按钮、~tokens/¥ 显示 | — |
| 25 | Diff | 左右分屏 / 同步滚动 / LCS 行级 + dmp 字符级（<5000） | 模块说明 4 | ✅ | `DiffView.tsx`、`diff.ts` | — |
| 26 | Diff | **四色变更标记——重排（橙色）检测** | 模块说明 4 | ❌ | `buildDiffLines` 只产出 added/removed/replaced，**永不产生 reordered 块**（样式与 UI 映射都已备好，引擎没实现）；PRD 5.8「忽略重排」开关同样无载体 | P1 |
| 27 | Diff | 变更块列表（Change Summary） | 模块说明 4 | ✅ | `DiffView.tsx` change-summary 下拉 | — |
| 28 | Diff | 悬停气泡（≥150ms，400ms 消失，5s 自隐，待确认⚠） | 模块说明 4；PRD 5.5 | ✅ | `DiffView.tsx` handleLineHover 时序与 PRD 一致 | — |
| 29 | Diff | 逐块接受/拒绝 / 全量二次确认 / 导航 / 统计栏 / 键盘 N·P·Enter·A·R | 模块说明 4 | ✅ | `useStore.ts` + `App.tsx` 快捷键（注：单击变更行只选中不自动开 ModLog，需 Enter 或点气泡，与说明"点击变更块→打开日志 Tab"略有出入，不影响闭环） | — |
| 30 | Diff | 忽略纯格式/空行开关 | 模块说明 4 | ✅ | `ignoreWhitespace` + 工具条 checkbox，切换后重算 | — |
| 31 | Diff | 退出保护 / 全部处理完毕生成新版本 | 模块说明 4 | ✅ | `closeDiff` confirm；`checkAllResolved` → `applyChanges` → `createVersion` | — |
| 32 | 修改日志 | 毛玻璃面板 / 类型徽标 / 位置 / 片段对比 / Why·How·Effect / 免责声明 / 待确认标记 / 说明可编辑 / 点外部·Esc 关闭 / 钉住 | 模块说明 5 | ✅ | `ModLogTab.tsx` + `index.css` backdrop-filter: blur(16px) | — |
| 33 | 修改日志 | **元信息（模型名/token/成本/版本号）** | 模块说明 5 | 🟡 | UI 已渲染 `cb.modelId/tokens/costEst`，但 `openDiff` 合并说明时**从未给 changeBlock 写入这些字段**，元信息区恒为空 | P1 |
| 34 | 版本 | 自动快照 / 时间线 / 标注 / 回滚（不覆盖）/ 重命名 / 导出 changelog / 导出 SKILL.md / IndexedDB 持久化 | 模块说明 6 | ✅ | `VersionTimeline.tsx`、`db.ts`、`useStore.ts` createVersion/rollback | — |
| 35 | 版本 | 任意两版本对比 | PRD 5.6 | ❌ | 无版本间 diff 入口 | P2 |
| 36 | 版本 | 版本迭代 AI 摘要（两级披露、跨版本汇总） | PRD 5.6.1 | ❌ | `db.ts` 已预留 `summaryBrief/summaryDetail/summaryStatus` 字段，无生成逻辑与 UI | P1 |
| 37 | 版本 | 导出 skill 文件结构（SKILL.md + references + scripts） | PRD 5.6 | 🟡 | 仅导出单文件 SKILL.md 内容，不含目录结构打包 | P2 |
| 38 | 设置 | 傻瓜式四步接入 / 自定义供应商 / 连接测试错误分类（401/404/429/超时/网络） / 打码不可回显 / localStorage 持久化 | 模块说明 7 | ✅ | `SettingsModal.tsx`、`adapter.ts testConnection`、`crypto.ts maskApiKey` | — |
| 39 | 设置 | **API Key 安全存储（系统凭据库→AES-256-GCM→环境变量）** | 模块说明 7；PRD 8.6 | 🟡 | `crypto.ts` 仅 base64 混淆存 localStorage（注释自承"not real encryption"）。系统凭据库/环境变量在纯 Web 不可行（见第 4 节排除项），但 AES-256-GCM（WebCrypto）可做而未做 | P1 |
| 40 | 设置 | Gemini 等鉴权方式扩展（Query key） | PRD 5.3 模板清单 | ❌ | adapter 只支持 bearer-header / x-api-key 两种 auth，无法承载 Gemini Query `key`，阻塞 8 家模板扩展 | P1 |
| 41 | 工作区 | 导入文件/文件夹（去重、移除、webkitRelativePath） | 模块说明 8.2 | ✅ | `WorkspaceScope.tsx` + store import 系 action | — |
| 42 | 工作区 | 范围创建/模块解析/勾选/全选/行号/层级缩进/统计/锁定分组/切换激活 | 模块说明 8.3 | ✅ | `WorkspaceScope.tsx` 全部在 | — |
| 43 | 工作区 | **安全编辑：锁定/未选模块在编辑器中强制只读** | 模块说明 8.3 第三层 | ❌ | `CodeEditor.tsx` 完全不读 workspaceScopes，锁定仅是 UI 状态，编辑器无任何区域编辑限制 | P1 |
| 44 | 工作区 | **从已导入文件一键圈选组成新工作区** | 模块说明 8.5 | ❌ | 文档自承"UI 链路未打通"，代码核实：导入文件列表只有删除按钮，无勾选/组成范围入口 | P1 |
| 45 | 工作区 | 工作区与导入文件持久化 | 模块说明 8（隐含）；PRD 数据模型 | ❌ | `workspaceScopes`/`importedFiles` 只在 Zustand 内存，Dexie schema 无对应表，刷新即丢 | P1 |
| 46 | 工作区 | 工作区引用检索（BM25、@提及、引用确认条、只读预览） | PRD 5.2.2 | ❌ | 无任何实现 | P1 |
| 47 | 划词引用 | 圈选触发浮动工具栏（≥2 字符、50ms） | 模块说明 9 | 🟡 | `CodeEditor.tsx` 有选区浮动按钮（80ms），但**只有"引用到对话"一个操作**，无字符数显示 | P1 |
| 48 | 划词引用 | **四快捷操作：询问/解释/优化/修复** | 模块说明 9 | ❌ | src 版无此工具栏（仅旧版 `js/selection-toolbar.js` 有，未移植） | P1 |
| 49 | 划词引用 | 来源识别（编辑器/修改前/修改后） | 模块说明 9 | 🟡 | 编辑器内标注 `## 标题 (Lx-y)` ✅；**Diff 左右面板完全没有选区捕获** | P1 |
| 50 | 划词引用 | 结构化引用 / 引用移除 / store 拼接清除 | 模块说明 9 | ✅ | `chatReference` + ChatPanel 引用 chip + blockquote 拼接 | — |
| 51 | 划词引用 | "解释/优化"自动发送 | 模块说明 9 | ❌ | 无快捷操作故无自动发送 | P1（随 #48） |
| 52 | 测试沙箱 | 多模型同输入对比、评分、按版本留存 | PRD 5.7 | ❌ | 无 | P2（建议降为增强） |
| 53 | 成本统计 | 月度汇总视图（供应商对比） | PRD 5.8 | ❌ | 仅单条回复成本展示，无汇总 | P2 |

---

## 3. P0 / P1 待办明细

### P0（核心闭环阻断项，优先修）

**P0-1｜规则集切换失效（#9）**
- 功能描述：TopBar 规则集下拉切换后应真正切换 `rulesetId` 并重跑校验。
- 涉及文件：`src/components/Layout/TopBar.tsx`、`src/store/useStore.ts`
- 实现要点：onChange 调用新增的 `setRuleset(id)` action（set rulesetId → runValidation()）；如有持久化需求同步写 `db.docs.rulesetId`。
- 验收标准：切到"通用 Prompt"后校验结果按新规则集刷新；刷新页面后规则集选择保持。

**P0-2｜行内校验波浪线（#3）**
- 功能描述：校验问题需在编辑器行内以波浪线呈现，与右侧面板双通道。
- 涉及文件：`src/components/Editor/CodeEditor.tsx`
- 实现要点：启用已定义的 `createLinter`，用 `lintConf.reconfigure(linter(...))` 在 `validationIssues` 变化时重配；实现行号→文档偏移映射（`view.state.doc.line(n).from`）。
- 验收标准：制造一个 error（如删 name 字段），对应行出现红色波浪线 + gutter 标记，hover 显示规则文案。

**P0-3｜校验面板点击跳转定位（#4）**
- 功能描述：点击面板问题项，编辑器滚动并选中对应行。
- 涉及文件：`ValidationPanel.tsx`、`CodeEditor.tsx`（需暴露 view 实例或经 store 传 pending jump 行号）
- 实现要点：store 增加 `pendingJumpLine`，CodeEditor useEffect 监听后 `dispatch({ selection, effects: EditorView.scrollIntoView(...) })`。
- 验收标准：点击任意 issue，编辑器定位到该行并高亮。

**P0-4｜增量模式"选中区块"链路（#18）**
- 功能描述：增量模式应发送编辑器当前选中内容，当前 selectedText 永远为空导致退化为文档前 500 字。
- 涉及文件：`CodeEditor.tsx`（updateListener 中同步 `setSelectedText`）、`useStore.ts` `buildContextMessages`
- 实现要点：选区变化时写 store；增量模式 prompt 构造时无选区应明确提示用户"未选中内容，将发送文档开头片段"。
- 验收标准：选中一段后切换增量模式发送，请求体中仅含选中片段+规则摘要（DevTools 可验证）。

### P1（重要体验/能力补齐）

**P1-1｜Diff 重排（reorder）检测（#26）**
- 描述：引擎识别"模块/块整体移动"并输出 `reordered` 类型块（橙色），UI/样式已就绪只差引擎。涉及 `src/lib/diff.ts`（在 LCS 结果上做块级移动检测，如相同文本块出现在不同位置时标记为 move）；同时落地 PRD 5.8「忽略重排」开关。验收：自动整理产生的顺序变化显示为橙色"重排"而非大片红绿。

**P1-2｜修改日志元信息填充（#33）**
- 描述：`openDiff` 合并 explanation 时把来源消息的 `modelId/tokens/costEst` 一并写入 changeBlock；版本号在 `createVersion` 时回填 versionFrom/versionTo。涉及 `useStore.ts`。验收：ModLog 元信息区显示模型名、token、成本、版本号。

**P1-3｜自动整理生成版本快照 + 预览确认（#5）**
- 描述：`doAutoOrganize` 先弹排序前后模块顺序预览，确认后应用并调 `createVersion('自动整理模块顺序', ...)`。涉及 `useStore.ts`、`TopBar.tsx`。验收：整理后版本时间线出现对应新版本。

**P1-4｜校验规则补齐（#10/#11/#12/#13）**
- 描述：实现 forbid-field（禁止 frontmatter 字段）、未知模块告警、YAML frontmatter 语法合法性校验、imperative-verbs 祈使句检测。涉及 `validation.ts`、`types/index.ts`（规则类型扩展）。验收：四类规则各有正/反用例命中。

**P1-5｜规则集导入（规范文档提炼）（#15）+ 自定义规则集（#8）**
- 描述：拖入规范 .md → AI 辅助提炼结构/格式/风格规则草案 → 用户确认编辑 → 存为自定义规则集（Dexie 持久化）；补齐第 4 套"自定义"空白模板。涉及 `rulesets.ts`、新增 RulesetManager UI、`db.ts` 加表。验收：导入一份规范文档能生成可编辑规则草案，确认后出现在 TopBar 下拉并生效。

**P1-6｜供应商模板扩至 8 家 + Gemini Query-key 鉴权（#23/#40）**
- 描述：补 Gemini/Moonshot/通义千问/Ollama/OpenRouter 模板；adapter 增加 `auth.type: 'query-key'`（Gemini `:streamGenerateContent?key=...`，SSE 解析 `candidates[0].content.parts`）；Ollama 无鉴权直连 `localhost:11434`。涉及 `providers.ts`、`adapter.ts`、`crypto.ts` 定价表。验收：5 家新模板均可通过"测试连接"（本地可用 Ollama 实测，其余以 401 分类正确为准）。

**P1-7｜API Key AES-256-GCM 加密存储（#39）**
- 描述：用 WebCrypto 生成设备级密钥（存 IndexedDB 不可导出），Key 密文存 localStorage，替代 base64。涉及 `crypto.ts`。验收：localStorage 中无明文/可逆 base64；重启后自动解密可用。

**P1-8｜划词工具栏四操作 + 自动发送 + Diff 面板选区（#47/#48/#49/#51）**
- 描述：把旧版 `js/selection-toolbar.js` 能力移植为 React 组件：显示字符数 + 询问/解释/优化/修复四按钮；解释/优化自动发送；DiffView 左右面板挂载同一工具栏并标注来源（修改前/修改后）。涉及：新增 `components/shared/SelectionToolbar.tsx`、`CodeEditor.tsx`、`DiffView.tsx`、`useStore.ts`（快捷操作 → sendChatMessage）。验收：编辑器与 Diff 两侧划词均出工具栏，点"优化"自动发消息且带结构化引用。

**P1-9｜工作区锁定强制只读 + 圈选导入文件组成工作区 + 持久化（#43/#44/#45）**
- 描述：① 编辑器按激活范围限制编辑（锁定/未选模块区域只读，可用 CM6 `EditorState.readOnly` 区间 facet 或 transaction filter）；② 已导入文件列表加勾选框 + "组成新工作区"按钮，将勾选文件内容解析模块后建范围；③ `workspaceScopes`/`importedFiles` 落 Dexie。涉及 `WorkspaceScope.tsx`、`CodeEditor.tsx`、`useStore.ts`、`db.ts`。验收：锁定范围内敲键盘无变化；勾选 2 个导入文件可一键建范围；刷新后范围与文件仍在。

**P1-10｜版本迭代 AI 摘要（#36）**
- 描述：基于已持久化 changeBlocks 合成摘要（不重读全文），版本节点"摘要"入口：第一击 3-5 条简要、第二击展开全部 Why/How/Effect；按需生成并持久化到 `summaryBrief/summaryDetail`。涉及 `db.ts`（字段已有）、`VersionTimeline.tsx`、新增摘要生成 action。验收：摘要与变更块一一对应，二次打开秒开（≤500ms）。

**P1-11｜工作区引用检索（#46，PRD 5.2.2）**
- 描述：文件路径显式识别 + @提及模糊搜索 + 引用确认条（✓确认/疑似/移除 + token 预估 + 只读预览），硬性约束"确认前永不静默注入"。涉及 `ChatPanel.tsx`、`useStore.ts`、新增检索 lib（可先文件名/路径匹配，BM25 后置）。验收：消息含 `references/fields.md` 时出现待确认 chip，确认后注入上下文，全程可见可改。

---

## 4. 明确排除项（本期不做）

| 功能点 | 出处 | 排除理由 |
|---|---|---|
| **系统凭据库存储**（Windows Credential Manager / macOS Keychain） | 模块说明 7；PRD 8.6 | 纯浏览器 Web 环境无法访问 OS 凭据库，需 Tauri/Electron 桌面壳才可行。本期以 P1-7（AES-256-GCM + WebCrypto）替代，并在设置页文案中如实说明（当前 SettingsModal 文案"系统凭据库优先"系虚假宣传，需随 P1-7 一并修正） |
| **环境变量引用** | 模块说明 7 | 浏览器无进程环境变量概念，桌面化后再议 |
| **Ollama 自动发现本机模型** | PRD 附录 A/5.10 | 浏览器混合内容（https 页面调 http://localhost）与 CORS 限制使"自动发现"不可靠；本期保留手动填 Base URL 的 Ollama 模板即可 |
| **测试沙箱**（PRD 5.7） | PRD 5.7 | 依赖多供应商接入稳定（P1-6）与评分体系设计，属独立大块，建议 M2 后期单独立项，本期不拆进差距待办 |
| **月度成本汇总视图**（PRD 5.8 后半） | PRD 5.8 | 需先沉淀每次请求的真实 token 计量（当前为 4 字符≈1 token 粗估），数据基础未备好，降 P2 |
| **任意两版本对比 / skill 目录结构打包导出**（PRD 5.6 扩展） | PRD 5.6 | 单文件 SKILL.md 导出已覆盖主场景，降 P2 |
| **`promptstudio-app.html` 单文件原型** | 任务约定 | 按团队约定不在本期范围 |

---

## 5. 统计摘要

- 核对功能点 53 项：✅ 已实现 24 项（45%），🟡 部分实现 12 项（23%），❌ 未实现 17 项（32%）
- **P0 待办 4 项**：规则集切换失效、行内波浪线缺失、校验点击跳转缺失、增量模式选区链路断裂（均为主闭环上的"宣称有但实际断"的问题，建议最优先）
- **P1 待办 11 项**：集中在规则引擎补齐、供应商扩展、划词工具栏移植、工作区三层控制落地、版本摘要
- **核心闭环「编辑 → AI 修改 → Diff → 逐块接受/拒绝 → 版本沉淀」主干已通**（Diff/ModLog/版本三模块完成度最高），差距主要在"宣称能力与实际接线不一致"的隐性断点与 P1 增强层

*本报告基于 2026-08-05 代码快照逐项核实，证据均标注文件路径。*
