/* ============================================================
   PROMPTSTUDIO — Data (Sample Docs, Rules, Providers, Mocks)
   ============================================================ */

// ── Sample Document Content ──

export const SAMPLE_DOC = `---
name: main-agent-coordinator
description: 主协调 agent prompt，负责协调子 agent 完成任务处理
---

# 主协调 Agent Prompt

## Instructions

你是一个任务协调 agent。你的核心职责是接收用户的查询请求，将其分解为子任务，并协调各子 agent 完成任务执行。

当用户提出请求时，请按以下步骤处理：

1. **解析意图**：识别用户请求中的关键信息（实体/参数/时间范围）
2. **分解任务**：将复杂请求拆分为可并行的子任务
3. **调度子 Agent**：将子任务分配给对应的领域 agent
4. **汇总结果**：合并各子 agent 返回的数据，生成统一视图

## Output Format

请始终以 JSON 格式输出分析结果，包含以下字段：

\`\`\`json
{
  "intent": "用户意图描述",
  "entities": ["实体列表"],
  "subtasks": ["子任务列表"],
  "results": "汇总结果"
}
\`\`\`

## Examples

用户输入："帮我分析过去一个季度的数据趋势"
→ 解析时间范围和数据类型 → 并行查询 → 汇总对比

## References

- 数据定义参见 references/fields.md
- 子 Agent 通信协议参见 SKILL.md 各子 agent 目录
`;

export const SAMPLE_DOC_MODIFIED = `---
name: main-agent-coordinator
description: 主协调 agent prompt，负责协调子 agent 完成任务处理
---

# 主协调 Agent Prompt

## Instructions

你是任务协调 agent。核心职责：接收用户查询请求，分解为子任务，协调各子 agent 完成任务执行。

**处理步骤（严格按顺序执行）**：

1. **解析意图**：识别用户请求中的关键信息（实体、参数、时间范围）
2. **分解任务**：将复杂请求拆分为可并行的子任务
3. **调度子 Agent**：将子任务分配给对应的领域 agent
4. **汇总结果**：合并各子 agent 返回的数据，生成统一视图
5. **校验输出**：检查 JSON 格式合规性与数据完整性

## Output Format

**必须以 JSON 格式输出**，不得包含额外说明文字。JSON Schema 如下：

\`\`\`json
{
  "intent": "用户意图描述（字符串）",
  "entities": ["实体列表（字符串数组）"],
  "subtasks": ["子任务列表（字符串数组）"],
  "results": "汇总结果（结构化对象）",
  "confidence": 0.0
}
\`\`\`

## Examples

### 示例 1：趋势分析
用户输入："帮我分析过去一个季度的数据趋势"
→ 解析时间范围和数据类型
→ 并行查询 → 汇总对比输出

### 示例 2：多维度对比
用户输入："对比产品A、B、C的核心指标"
→ 解析三个产品、多个指标
→ 并行查询各产品数据 → 交叉对比 → 表格输出

## References

- 数据定义参见 references/fields.md
- 子 Agent 通信协议参见 SKILL.md 各子 agent 目录
- 数据校验规则参见 references/validation-rules.md
`;

// ── Validation Rules ──

export const RULES = {
  anthropic: {
    structure: [
      { check: (c) => /^---\s*\nname:\s*\S/.test(c), msg: 'SKILL.md 必须包含 name frontmatter 字段', level: 'error' },
      { check: (c) => /description:\s*\S/.test(c), msg: '缺少 description frontmatter 字段', level: 'error' },
      { check: (c) => /##\s*Instructions/i.test(c), msg: '缺少 Instructions 章节', level: 'warning' },
    ],
    format: [
      { check: (c) => !/```\s*(?!\w+)/.test(c.replace(/```\w+/g, '')), msg: '代码块需带语言标签', level: 'warning' },
      { check: (c) => !/^#{4,}\s/m.test(c), msg: 'Markdown 标题层级不超过 3 级', level: 'warning' },
    ],
    style: [
      { check: (c) => !/尽量|可能的话/.test(c), msg: '禁止使用模糊词（尽量/可能的话）削弱指令确定性', level: 'warning' },
      { check: (c) => !/你\s*应该|你\s*可以/.test(c) || /你\s*(必须|需要|要)/.test(c), msg: '指令建议用祈使句，减少"你应该/你可以"', level: 'info' },
    ],
    order: ['frontmatter', 'instructions', 'output format', 'examples', 'references'],
  },
  generic: {
    structure: [
      { check: (c) => c.length > 50, msg: 'Prompt 内容过短，建议补充更多上下文', level: 'warning' },
    ],
    format: [],
    style: [
      { check: (c) => !/尽量|可能的话/.test(c), msg: '禁止使用模糊词', level: 'warning' },
    ],
    order: [],
  },
};

// ── Provider Templates ──

export const PROVIDERS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    desc: 'deepseek-chat / deepseek-reasoner — OpenAI 兼容协议',
    baseUrl: 'https://api.deepseek.com',
    defaults: { model: 'deepseek-chat' },
    iconBg: '#4C6EF5',
    iconText: 'DS',
    status: 'ok',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    desc: 'gpt-4o / gpt-4o-mini — Bearer Token 鉴权',
    baseUrl: 'https://api.openai.com/v1',
    defaults: { model: 'gpt-4o' },
    iconBg: '#10A37F',
    iconText: 'OA',
    status: 'unknown',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    desc: 'claude-sonnet-5 / claude-haiku-4.5 — x-api-key 鉴权',
    baseUrl: 'https://api.anthropic.com/v1',
    defaults: { model: 'claude-sonnet-5' },
    iconBg: '#D97706',
    iconText: 'AN',
    status: 'unknown',
  },
];

// ── Model List (for dropdown) ──

export const MODEL_LIST = [
  { id: 'deepseek-chat',     provider: 'deepseek',  name: 'DeepSeek Chat',       desc: '快速、高性价比的通用推理' },
  { id: 'deepseek-reasoner', provider: 'deepseek',  name: 'DeepSeek Reasoner',    desc: '高级思维链推理，复杂任务优先' },
  { id: 'claude-sonnet-5',   provider: 'anthropic', name: 'Claude Sonnet 5',      desc: '高质量创意写作与代码生成' },
  { id: 'claude-haiku-4.5',  provider: 'anthropic', name: 'Claude Haiku 4.5',     desc: '极速响应，适合简单任务' },
  { id: 'gpt-4o',            provider: 'openai',    name: 'GPT-4o',               desc: '通用多模态，均衡性能' },
  { id: 'gpt-4o-mini',       provider: 'openai',    name: 'GPT-4o Mini',          desc: '轻量快速，成本最优' },
];

// ── Mock Change Blocks ──

export const MOCK_CHANGE_BLOCKS = [
  {
    id: 'cb1',
    type: 'replace',
    oldRange: 'L10-L12',
    newRange: 'L10-L14',
    oldSnippet: '你是一个任务协调 agent。你的核心职责是…',
    newSnippet: '你是任务协调 agent。核心职责：…',
    why: '祈使句语气更直接，减少"你"字冗余，模型遵循率更高。关联规则：style/person-consistency',
    how: '将 Instructions 章节中的描述性语句改为强祈使句，去掉冗余代词，精简指令结构。',
    effect: '指令确定性增强，输出格式更稳定，预计歧义率降低 20%+。',
    model: 'DeepSeek Chat',
    tokens: '2.4k',
    cost: '¥0.004',
    version: 'v3→v4',
    accepted: null,
  },
  {
    id: 'cb2',
    type: 'add',
    oldRange: '—',
    newRange: 'L16-L17',
    oldSnippet: '(不存在)',
    newSnippet: '5. **校验输出**：检查 JSON 格式合规性与数据完整性',
    why: '当前版本缺少输出校验步骤，模型可能输出不符合规范的 JSON。关联规则：structure/require-validation-step',
    how: '在 Instructions 步骤列表末尾新增第 5 步校验步骤。',
    effect: 'JSON 输出格式合规率预计提升 30%+，减少下游解析错误。',
    model: 'DeepSeek Chat',
    tokens: '0.8k',
    cost: '¥0.001',
    version: 'v3→v4',
    accepted: null,
  },
  {
    id: 'cb3',
    type: 'add',
    oldRange: '—',
    newRange: 'L25-L28',
    oldSnippet: '(不存在)',
    newSnippet: '### 示例 2：多维度对比\n用户输入："对比产品A、B、C的核心指标"…',
    why: '覆盖更多使用场景（多指标对比），提升模型在复杂查询下的表现。',
    how: '丰富示例场景，展示三个实体 + 多个指标的并行查询流程。',
    effect: '丰富模型 Few-shot 学习样本，复杂查询准确率预计提升。',
    model: 'DeepSeek Chat',
    tokens: '1.0k',
    cost: '¥0.002',
    version: 'v3→v4',
    accepted: null,
  },
];

// ── Initial State ──

export const INITIAL_STATE = {
  doc: {
    currentFile: 'skill-main',
    currentDoc: 'SKILL.md — 主Agent',
    content: SAMPLE_DOC,
    candidateContent: null,
  },
  ui: {
    activeView: 'editor',       // 'editor' | 'chat' | 'history'
    chatPanelOpen: true,
    diffActive: false,
    modLogOpen: false,
    modLogPinned: false,
    settingsOpen: false,
    showReasoning: true,
  },
  validation: {
    results: [],
  },
  chat: {
    messages: [],
    isStreaming: false,
    selectedModel: 'deepseek-chat',
  },
  diff: {
    changeBlocks: [],
    currentChangeIdx: -1,
  },
  versions: {
    current: 3,
    list: [
      { id: 1, label: 'v1', time: '11:00', content: SAMPLE_DOC, note: '初始版本' },
      { id: 2, label: 'v2', time: '13:15', content: SAMPLE_DOC_MODIFIED, note: '增加财务指标定义' },
      { id: 3, label: 'v3', time: '14:32', content: SAMPLE_DOC_MODIFIED, note: '当前版本' },
    ],
  },
  settings: {
    activeProvider: 'deepseek',
    modelName: 'deepseek-chat',
    apiKey: '••••••••••',
    baseUrl: 'https://api.deepseek.com',
  },
};
