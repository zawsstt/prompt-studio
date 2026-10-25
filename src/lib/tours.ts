// ── Module tours (P1-13) ──
//
// 每个功能模块首次打开时播放一次轻量引导；关闭后不再自动出现，
// 但模块标题旁的「?」和设置 → 关于 → 功能引导都可以重播。
// 选择器优先用现有 DOM 类名；目标不存在时该步自动降级为居中卡片。

export type TourId = 'editor' | 'chat' | 'workspace' | 'eval' | 'history' | 'ruleset' | 'diff';

export interface TourStep {
  /** CSS selector of the anchored element; omit for a centered card. */
  target?: string;
  title: string;
  body: string;
  /** Optional inline illustration rendered inside the tour popover. */
  visual?: 'voice-modes';
}

export interface TourDefinition {
  title: string;
  steps: TourStep[];
}

export const TOURS: Record<TourId, TourDefinition> = {
  editor: {
    title: '编辑工作区',
    steps: [
      {
        target: '.code-pane',
        title: '这里是 Prompt 正文',
        body: '直接编辑 Markdown / Skill 内容：语法高亮、自动补全、行号定位都在这一块。左侧行号可点击，右侧 AI 对话不会挤占它。',
      },
      {
        target: '.validation-panel, .validation-panel-collapsed',
        title: '底部实时校验',
        body: '规则集发现的结构、顺序、格式问题会实时列在这里。点击条目会跳到对应行；全部通过时显示绿色提示。',
      },
      {
        target: '.topbar .tabs',
        title: '四个工作视图',
        body: '对比：逐块审阅 AI 修改；历史：版本时间线与回归基线；规则集：约束管理；评测：用例、断言与分数。',
      },
      {
        target: '.chat-panel',
        title: '右侧 AI 对话',
        body: '描述修改意图，AI 会生成候选；点「应用为候选修改」进入对比。选中文字还会出现划词工具条，可以直接询问、解释或优化。',
      },
    ],
  },
  chat: {
    title: 'AI 对话',
    steps: [
      {
        target: '.chat-header',
        title: '模型与清空',
        body: '顶部可以切换当前模型、清空对话。换模型也可以直接用顶栏的模型胶囊快速切换。',
      },
      {
        target: '.chat-messages',
        title: '回复与候选',
        body: 'AI 回复下方有「应用为候选修改」和「复制回复」。应用后自动进入对比视图，逐块接受或拒绝。',
      },
      {
        target: '.context-bar',
        title: '上下文模式',
        body: '全文模式发送完整文档；增量模式只发送选中区块 + 规则摘要，能省下大量 token。',
      },
      {
        target: '.chat-input-area',
        title: '输入与引用',
        body: 'Enter 发送、Shift+Enter 换行。选中编辑器文字后点「询问」，引用会收进输入卡片顶部，再补充你的问题即可。',
      },
      {
        target: '.voice-input-wrapper, .voice-mic-btn',
        title: '语音输入：安全 / 直出',
        body: '点麦克风或按 T 开始说话。两种模式的识别过程完全一样，区别只在结束后的动作；语音卡片模式条的「演示」可随时重看。',
        visual: 'voice-modes',
      },
    ],
  },
  workspace: {
    title: '工作区范围',
    steps: [
      {
        target: '.ws-toolbar',
        title: '导入文件或文件夹',
        body: '支持单个 Markdown / 文本文件，也支持整个文件夹（保留目录结构）。导入的内容可以作为对话上下文或参与多文件对比。',
      },
      {
        target: '.ws-scope-list',
        title: '用范围圈住安全区域',
        body: '选择文档模块或导入文件组成工作区范围；锁定范围后该区域只读，避免 AI 改到不该改的地方。',
      },
      {
        title: '应用到 AI 对话',
        body: '范围应用后，右侧对话会自动带上范围上下文；同一范围里的多个文件会联动检查引用，并逐一进入对比。',
      },
    ],
  },
  eval: {
    title: '提示词评测',
    steps: [
      {
        target: '.ev-cases',
        title: '① 用例',
        body: '新建、复制、删除用例。每条用例显示变量数与断言数；左侧列表就是这次要跑的测试集。',
      },
      {
        target: '.ev-editor',
        title: '② 用例详情',
        body: '填写用户输入、变量和断言。模板里的 {{变量}} 会自动检测，缺失的会提示补入；全部断言通过才算用例通过。',
      },
      {
        target: '.ev-results',
        title: '③ 结果矩阵',
        body: '看通过数、平均耗时、tokens 与成本。点任一结果行展开模型输出全文、每条断言的判定理由和耗时。',
      },
      {
        title: '回归基线',
        body: '每次运行都会绑定版本与用例快照。和基线对比时，退化的用例会标出失败断言，并定位到最可疑的 changeBlock。',
      },
    ],
  },
  history: {
    title: '版本历史',
    steps: [
      {
        target: '.version-baseline',
        title: '回归基线分曲线',
        body: '每个版本取最近一次评测分数，涨跌一眼可见。点条目会跳到对应版本卡片；没有评测的版本显示「未评测」。',
      },
      {
        target: '.version-timeline',
        title: '版本时间线',
        body: '回滚会生成新版本，不覆盖历史；每个版本都可以导出变更日志、SKILL.md 或生成变更摘要。',
      },
      {
        title: '评测某个历史版本',
        body: '版本卡片上的「评测此版本」会用当前用例集跑历史内容，结果自动绑定到该版本，曲线因此能持续累积。',
      },
    ],
  },
  ruleset: {
    title: '规则集',
    steps: [
      {
        target: '.rsm-head',
        title: '规则集总览',
        body: '这里管理内置规则集和自定义规则集；当前使用的规则集会实时作用于编辑器的校验。',
      },
      {
        target: '.rsm-list',
        title: '展开查看具体规则',
        body: '每个规则集可以展开查看结构、顺序、格式与风格规则，也可以直接编辑 JSON 或复制一份再改。',
      },
      {
        title: '从规范文档导入',
        body: '顶栏「导入规则集」可以上传 Markdown 规范，自动提炼 frontmatter 字段、模块顺序和格式规则，再逐条勾选保留。',
      },
    ],
  },
  diff: {
    title: '对比审阅',
    steps: [
      {
        target: '.diff-toolbar',
        title: '审阅工具条',
        body: '这里可以切换忽略纯格式 / 重排，跳转上一处 / 下一处，也可以一键接受全部或拒绝全部。',
      },
      {
        target: '.dc-view',
        title: '左右对照',
        body: '左边是修改前，右边是候选，滚动同步。点变更行或变更块可以打开修改说明，逐块决定接受还是拒绝。',
      },
      {
        target: '.diff-stats',
        title: '处理完生成版本',
        body: '底部实时统计新增、删除与 tokens。全部处理完后会提示生成新版本，之后可以在历史里回滚或评测。',
      },
    ],
  },
};

export const TOUR_IDS = Object.keys(TOURS) as TourId[];

export const TOUR_LABELS: Record<TourId, string> = {
  editor: '编辑工作区',
  chat: 'AI 对话',
  workspace: '工作区范围',
  eval: '提示词评测',
  history: '版本历史',
  ruleset: '规则集',
  diff: '对比审阅',
};
