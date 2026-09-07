// ── Core Type Definitions ──

export type ProviderCompat = 'openai' | 'anthropic' | 'gemini';

export interface ProviderTemplate {
  providerId: string;
  name: string;
  baseUrl: string;
  auth: {
    type: 'bearer-header' | 'x-api-key' | 'query-key' | 'none';
    headerName?: string;
    prefix?: string;
    queryParam?: string;
  };
  endpoints: {
    chat: string;
    models?: string;
  };
  compat: ProviderCompat;
  streaming: boolean;
  defaultModels: string[];
  extraHeaders: Record<string, string>;
  iconBg: string;
  iconText: string;
  /** 真实品牌图标（public/icons/*），未提供时回退到 iconBg/iconText 色块 */
  iconUrl?: string;
}

export interface ModelConfig {
  id: string;
  providerId: string;
  modelName: string;
  apiKeyRef: string;      // reference key for stored API key
  apiKeyMasked: string;   // masked display value
  baseUrlOverride?: string;
  lastTestedAt?: number;
  status: 'ok' | 'error' | 'unknown';
}

export interface RuleSet {
  id: string;
  name: string;
  description?: string;
  structureRules: StructureRule[];
  orderRules: OrderRule[];
  formatRules: FormatRule[];
  styleRules: StyleRule[];
  /** When true, modules not listed in orderRules are tolerated (no warning). Default false. */
  allowUnknownModules?: boolean;
}

export interface StructureRule {
  type: 'require-frontmatter' | 'require-module' | 'forbid-module' | 'forbid-field' | 'unknown-module';
  fields?: string[];
  module?: string;
  error: string;
  level: 'error' | 'warning' | 'info';
}

export interface OrderRule {
  module: string;
  position: number;
  optional?: boolean;
}

export interface FormatRule {
  type: 'codeblock-language' | 'heading-depth' | 'line-width' | 'yaml-frontmatter';
  enforce?: boolean;
  max?: number;
  warning?: boolean;
  error?: string;
}

export interface StyleRule {
  type: 'person-consistency' | 'imperative-verbs' | 'forbid-words';
  person?: string;
  words?: string[];
  enforce?: boolean;
  error?: string;
  level?: 'error' | 'warning' | 'info';
}

export interface ValidationIssue {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  ruleType: string;
}

export type ChangeBlockType = 'added' | 'removed' | 'replaced' | 'reordered';

export interface ChangeBlock {
  id: string;
  type: ChangeBlockType;
  oldStartLine: number;
  oldEndLine: number;
  newStartLine: number;
  newEndLine: number;
  oldSnippet: string;
  newSnippet: string;
  explanation?: {
    why: string;
    how: string;
    effect: string;
  };
  accepted: boolean | null;  // null = pending, true = accepted, false = rejected
  modelId?: string;
  tokens?: number;
  costEst?: number;
  versionFrom?: string;
  versionTo?: string;
  pendingConfirmation?: boolean;  // 说明待人工确认
}

export interface DiffLine {
  type: 'equal' | 'added' | 'removed' | 'replaced' | 'reordered' | 'empty';
  content: string;
  changeBlockIdx?: number;
  oldLineNum?: number;
  newLineNum?: number;
  charDiffs?: CharDiff[];
}

export interface CharDiff {
  type: 'equal' | 'add' | 'del';
  text: string;
}

export interface Version {
  id: string;
  docId: string;
  versionNumber: number;
  label: string;       // v1, v2, ...
  content: string;
  parentId: string | null;
  changeBlockIds: string[];
  changeBlocks: ChangeBlock[];
  note: string;
  createdAt: number;
  summaryBrief?: string[];
  summaryDetail?: string;
  summaryStatus?: 'none' | 'generating' | 'ready';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  timestamp: number;
  modelId?: string;
  tokens?: number;
  costEst?: number;
  appliedAsCandidate?: boolean;
  changeBlocks?: ChangeBlock[];
  rawResponse?: string;
}

export interface ChatSession {
  id: string;
  docId: string;
  messages: ChatMessage[];
  contextConfig: {
    scope: 'full' | 'incremental';
    includeRules: boolean;
    includeIterationSummary: boolean;
  };
  createdAt: number;
  updatedAt: number;
}

export interface PromptDoc {
  id: string;
  name: string;
  content: string;
  formatType: 'prompt' | 'skill' | 'other';
  rulesetId: string;
  createdAt: number;
  updatedAt: number;
}

// ── Workspace Scope ──
export interface WorkspaceScope {
  id: string;
  name: string;
  description: string;
  /** Module headings that are within this scope */
  modules: ScopeModule[];
  expanded: boolean;
  locked: boolean;
  /** 应用到 AI 对话：勾选的模块内容将注入聊天上下文 */
  applied: boolean;
  createdAt: number;
}

export interface ScopeModule {
  heading: string;       // e.g. "## Task"
  level: number;         // heading level (2, 3, etc.)
  startLine: number;
  endLine: number;
  selected: boolean;     // whether this module is in scope
  locked: boolean;       // editing is locked/restricted
}

/** 工作区联动检查：修改文件 A 后，同范围文件 B 引用了 A 的内容（需同步更新）。 */
export interface ScopeSyncIssue {
  filePath: string;
  fileLabel: string;
  kind: 'file' | 'module';
  matchedName: string;
  reason: string;
}

// ── Chat Reference (selected text → chat citation) ──
export interface ChatReference {
  text: string;
  sourceLabel: string;   // e.g. "## Task (L12-18)"
  startLine: number;
  endLine: number;
}

// ── Selection Toolbar (P1-8) ──
/** Where a text selection originated from. */
export type SelectionSource = 'editor' | 'diff-left' | 'diff-right';

/** The four quick actions offered by the floating selection toolbar. */
export type SelectionQuickActionType = 'ask' | 'explain' | 'improve' | 'fix';

/** Payload passed to the store's selectionQuickAction. */
export interface SelectionActionPayload {
  text: string;
  source: SelectionSource;
  startLine?: number;
  endLine?: number;
}

// ── Imported Files ──
export interface ImportedFileInfo {
  name: string;
  /** Relative path within the imported folder, or just filename */
  path: string;
  content: string;
  importedAt: number;
  /** 本地授权文件夹文件：相对目录根的路径（local:// 前缀 path 的写回凭据，内容不落库） */
  localPath?: string;
}

// ── Pending Reference (@mention / path detected in chat input) ──
export interface PendingReference {
  id: string;
  /** The raw mention token typed by the user, e.g. "references/fields.md" */
  mention: string;
  file: ImportedFileInfo;
  confidence: 'exact' | 'fuzzy';
  status: 'pending' | 'confirmed' | 'dismissed';
  tokenEst: number;
}
