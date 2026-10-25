import { create } from 'zustand';
import type {
  ValidationIssue, ChangeBlock, ChatMessage, Version,
  RuleSet, ProviderTemplate, PromptDoc, DiffLine,
  WorkspaceScope, ScopeModule, ChatReference, ImportedFileInfo,
  PendingReference, ChangeBlockType, ScopeSyncIssue,
  SelectionQuickActionType, SelectionActionPayload,
  EvalCase, Assertion, AssertionType, CaseResult, EvalRun,
} from '../types';
import { findRuleset } from '../data/rulesets';
import { PROVIDER_TEMPLATES, CUSTOM_TEMPLATE, getTemplate } from '../data/providers';
import { SAMPLE_DOC } from '../data/sampleDoc';
import { validate, autoOrganize, findModules, reorderModules } from '../lib/validation';
import { buildDiffLines, applyChanges, estimateTokens } from '../lib/diff';
import { parseModulesFromContent } from '../lib/scopeParse';
import { detectPathMentions, matchImportedFiles } from '../lib/referenceSearch';
import { sendMessage, testConnection, type ChatMessagePayload } from '../lib/api/adapter';
import {
  BUILTIN_RULES, collectSensitiveTokens, buildMaskRegistry,
  maskText, unmaskText, type MaskRegistry,
} from '../lib/sanitize';
import {
  pickLocalFolder as pickFolder, restoreLocalFolder as restoreFolder,
  requestLocalFolderPermission, listLocalFiles, readLocalFile, writeLocalFile,
  findLocalFileHandle, type LocalFolderInfo, type LocalFileNode,
} from '../lib/localFiles';
import { saveApiKey, getApiKey, deleteApiKey, maskApiKey, saveModelConfig, loadModelConfig, estimateCost } from '../lib/crypto';
import {
  db, saveVersion, getVersions, saveChatSession, getChatSession, saveDoc,
  exportVersionMarkdown, updateVersionSummary,
  saveRuleset, getCustomRulesets, deleteRuleset,
  saveWorkspaceScope, getWorkspaceScopes, deleteWorkspaceScope,
  saveImportedFile, getImportedFiles, deleteImportedFile,
  saveEvalRun, getEvalRuns,
  clearAllData,
  type VersionRecord,
} from './db';
import { runEval as runEvalCases } from '../lib/eval/runner';
import { extractVariables, scaffoldVars } from '../lib/eval/variables';
import { parseEvalConfig, stringifyEvalConfig, exampleEvalConfig, makeId } from '../lib/eval/config';
import { scoreRun } from '../lib/eval/baseline';
import { cloneCases, datasetHash } from '../lib/eval/dataset';
import {
  applyTheme, applyToolbarStyle, loadThemeMode, loadToolbarStyle,
  persistThemeMode, persistToolbarStyle,
  type ThemeMode, type ToolbarStyle,
} from '../lib/theme';
import type { TourId } from '../lib/tours';
import { toast } from '../components/shared/Toast';

export type SettingsSection = 'models' | 'appearance' | 'privacy' | 'about';

interface AppState {
  // ── Document ──
  docId: string;
  docName: string;
  docContent: string;
  candidateContent: string | null;
  rulesetId: string;

  // ── Validation ──
  validationIssues: ValidationIssue[];
  showValidationBanner: boolean;
  showValidationPanel: boolean;

  // ── Editor ──
  selectedText: string;
  /** One-shot intent field: editor scrolls to this line then clears it (P0-3). */
  pendingJumpLine: number | null;

  // ── Chat ──
  chatMessages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  streamingReasoning: string;
  contextMode: 'full' | 'incremental';
  showReasoning: boolean;

  // ── Diff ──
  diffActive: boolean;
  diffLeftLines: DiffLine[];
  diffRightLines: DiffLine[];
  changeBlocks: ChangeBlock[];
  currentChangeIdx: number;
  ignoreWhitespace: boolean;
  ignoreReorder: boolean;

  // ── Mod Log ──
  modLogOpen: boolean;
  modLogPinned: boolean;
  modLogChangeIdx: number;

  // ── Versions ──
  versions: VersionRecord[];

  // ── Settings ──
  settingsOpen: boolean;
  selectedProviderId: string;
  selectedModelName: string;
  apiKeyInput: string;
  baseUrlOverride: string;
  connectionStatus: 'idle' | 'testing' | 'success' | 'error';
  connectionMessage: string;

  // ── Workspace ──
  workspaceScopes: WorkspaceScope[];
  currentScopeId: string | null;
  importedFiles: ImportedFileInfo[];
  /** 当前在编辑区打开的文件（null = 主文档） */
  editingFilePath: string | null;
  /** 首次打开（无最近编辑记录）时显示引导欢迎页 */
  showWelcome: boolean;
  /** 新手指引弹窗（强提醒，可跳过） */
  showOnboarding: boolean;
  /** 打开文件时的内容快照（用于 diff 对比修改前后） */
  fileSnapshots: Record<string, string>;
  /** 联动检查：同范围文件对当前编辑文件的引用提醒 */
  scopeSyncIssues: ScopeSyncIssue[];
  /** 文件模式的规则校验结果 */
  fileValidationIssues: ValidationIssue[];
  /** diff 多文件队列（key: '' = 主文档；否则为文件 path） */
  diffQueue: { key: string; label: string; left: string; right: string }[] | null;
  currentDiffFileIdx: number;

  // ── Sensitive Data Sanitization（脱敏：AI 不可见原文） ──
  /** 用户自定义敏感词条（精确匹配，多文档全局同编号） */
  sensitiveTerms: string[];
  /** 脱敏总开关 */
  maskEnabled: boolean;
  /** 会话级映射表（编号 → 原文），仅驻留内存，永不发送 */
  maskRegistry: MaskRegistry | null;

  // ── Local Folder（本地授权文件夹：线上发布场景，内容不落库） ──
  localFolder: LocalFolderInfo | null;
  localFiles: LocalFileNode[];

  // ── Chat Reference ──
  chatReference: ChatReference | null;
  /** One-shot intent: prefill the chat input (consumed & cleared by ChatPanel). */
  pendingChatInput: string | null;

  // ── Auto-organize preview (P1-3) ──
  organizePreview: { before: string[]; after: string[]; result: string } | null;

  // ── Custom rulesets (P1-5) ──
  customRulesets: RuleSet[];

  // ── Workspace reference search (P1-11) ──
  pendingReferences: PendingReference[];

  // ── Ruleset import modal (P1-5 UI) ──
  rulesetImportOpen: boolean;

  // ── Evaluation (P0-1) ──
  evalCases: EvalCase[];
  evalSelectedCaseId: string | null;
  evalPromptRole: 'system' | 'user';
  evalRunning: boolean;
  evalResults: CaseResult[] | null;
  evalRuns: EvalRun[];
  evalError: string | null;
  /** P1-2: 指定用哪个版本的内容作为评测对象（null = 当前文档 / 打开的文件） */
  evalTargetVersionId: string | null;
  /** P1-2: 当前结果对应的运行记录 id（基线对比的“本次”） */
  evalCurrentRunId: string | null;

  // ── UI ──
  activeView: 'editor' | 'chat' | 'history' | 'workspace' | 'ruleset' | 'eval';

  // ── Actions ──
  init: () => Promise<void>;
  setDocContent: (content: string) => void;
  setSelectedText: (text: string) => void;
  runValidation: () => void;
  setShowValidationPanel: (show: boolean) => void;
  toggleValidationPanel: () => void;
  doAutoOrganize: () => void;
  setOrganizePreviewAfter: (after: string[]) => void;
  confirmAutoOrganize: () => Promise<void>;
  cancelAutoOrganize: () => void;
  setRuleset: (id: string) => Promise<void>;
  jumpToLine: (line: number) => void;

  // Sensitive Data Sanitization
  setSensitiveTerms: (terms: string[]) => void;
  setMaskEnabled: (enabled: boolean) => void;
  buildSessionMaskRegistry: () => MaskRegistry | null;

  // Reset
  resetAllData: () => Promise<void>;

  // Local Folder
  pickLocalFolder: () => Promise<void>;
  restoreLocalFolder: () => Promise<void>;
  reauthorizeLocalFolder: () => Promise<void>;
  refreshLocalFiles: () => Promise<void>;
  openLocalFile: (path: string) => Promise<void>;
  writeBackLocalFile: (path: string, content: string) => Promise<void>;

  // Chat
  sendChatMessage: (text: string) => Promise<void>;
  stopStreaming: () => void;
  applyAsCandidate: (messageId: string) => void;
  setContextMode: (mode: 'full' | 'incremental') => void;
  toggleReasoning: () => void;

  // Diff
  openDiff: () => void;
  closeDiff: () => void;
  acceptChange: (idx: number) => void;
  rejectChange: (idx: number) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  nextChange: () => void;
  prevChange: () => void;
  setIgnoreWhitespace: (val: boolean) => void;
  setIgnoreReorder: (val: boolean) => void;
  setModLogChange: (idx: number) => void;
  toggleModLog: (open?: boolean) => void;
  togglePin: () => void;

  // Settings
  settingsSection: SettingsSection;
  themeMode: ThemeMode;
  toolbarStyle: ToolbarStyle;
  setThemeMode: (mode: ThemeMode) => void;
  setToolbarStyle: (style: ToolbarStyle) => void;
  /** 模块引导（P1-13）：当前正在播放的引导 */
  activeTour: TourId | null;
  startTour: (id: TourId) => void;
  endTour: () => void;
  openSettings: (section?: SettingsSection) => Promise<void>;
  setSettingsSection: (section: SettingsSection) => void;
  closeSettings: () => void;
  setProvider: (id: string) => void;
  setModelName: (name: string) => void;
  setApiKeyInput: (key: string) => void;
  setBaseUrlOverride: (url: string) => void;
  doTestConnection: () => Promise<void>;
  doSaveSettings: () => Promise<void>;
  /** 顶栏模型胶囊快速切换：同时加载该供应商已保存的 Key */
  quickSwitchModel: (providerId: string, modelName: string) => Promise<void>;
  /** 查询各供应商是否已配置 Key（快速切换面板用） */
  loadProviderKeyStatus: () => Promise<Record<string, boolean>>;

  // Versions
  loadVersions: () => Promise<void>;
  createVersion: (note: string, content: string, changeBlocks?: ChangeBlock[]) => Promise<void>;
  rollbackToVersion: (versionId: string) => Promise<void>;
  renameVersion: (versionId: string, name: string) => Promise<void>;
  exportVersion: (versionId: string) => string | null;
  checkAllResolved: () => void;

  // Navigation
  setActiveView: (view: 'editor' | 'chat' | 'history' | 'workspace' | 'ruleset' | 'eval') => void;

  // Evaluation (P0-1)
  addEvalCase: () => void;
  updateEvalCase: (id: string, patch: Partial<Pick<EvalCase, 'name' | 'input'>>) => void;
  setEvalCaseVar: (id: string, key: string, value: string) => void;
  addEvalCaseVar: (id: string, key: string) => void;
  removeEvalCaseVar: (id: string, key: string) => void;
  removeEvalCase: (id: string) => void;
  duplicateEvalCase: (id: string) => void;
  selectEvalCase: (id: string | null) => void;
  addEvalAssertion: (caseId: string, type?: AssertionType) => void;
  updateEvalAssertion: (caseId: string, assertionId: string, patch: Partial<Assertion>) => void;
  removeEvalAssertion: (caseId: string, assertionId: string) => void;
  setEvalPromptRole: (role: 'system' | 'user') => void;
  importEvalConfig: (text: string) => boolean;
  loadExampleEvalCases: () => void;
  exportEvalConfig: () => string;
  runEval: () => Promise<void>;
  /** P1-2: 用历史版本内容跑一次评测，并把结果绑到该版本 */
  runEvalForVersion: (versionId: string) => Promise<void>;
  clearEvalTargetVersion: () => void;
  cancelEval: () => void;
  clearEvalResults: () => void;
  loadEvalRuns: () => Promise<void>;
  viewEvalRun: (id: string) => void;
  /** P1-2b: 把某次运行的用例集快照载回编辑器（会替换当前用例集） */
  restoreEvalSnapshot: (runId: string) => boolean;

  // Workspace
  parseDocumentModules: () => ScopeModule[];
  createScope: (name: string, description: string, modules: ScopeModule[]) => string;
  deleteScope: (id: string) => void;
  toggleModuleInScope: (scopeId: string, moduleHeading: string) => void;
  toggleScopeExpanded: (scopeId: string) => void;
  toggleScopeLocked: (scopeId: string) => void;
  toggleScopeApplied: (scopeId: string) => void;
  selectScope: (id: string | null) => void;
  selectAllModules: (scopeId: string) => void;
  deselectAllModules: (scopeId: string) => void;
  importFile: (file: File) => Promise<void>;
  importFolder: (files: File[]) => Promise<void>;
  removeImportedFile: (path: string) => void;
  createScopeFromFiles: (paths: string[], name: string, description?: string) => string;
  addFilesToScope: (scopeId: string, paths: string[]) => void;
  setEditingFile: (path: string | null) => void;
  updateImportedFileContent: (path: string, content: string) => void;
  checkScopeSync: () => void;
  runFileValidation: () => void;
  setDiffFile: (idx: number) => void;
  dismissOnboarding: () => void;

  // Chat Reference
  setChatReference: (ref: ChatReference | null) => void;
  clearChatReference: () => void;
  setPendingChatInput: (text: string | null) => void;

  // Selection toolbar quick actions (P1-8)
  selectionQuickAction: (action: SelectionQuickActionType, payload: SelectionActionPayload) => void;

  // Custom rulesets (P1-5)
  loadCustomRulesets: () => Promise<void>;
  saveCustomRuleset: (rs: RuleSet) => Promise<void>;
  removeCustomRuleset: (id: string) => Promise<void>;

  // Version summary (P1-10)
  generateVersionSummary: (versionId: string) => Promise<void>;

  // Workspace reference search (P1-11)
  detectReferences: (text: string) => void;
  confirmReference: (id: string) => void;
  dismissReference: (id: string) => void;

  // Ruleset import modal (P1-5 UI)
  openRulesetImport: () => void;
  closeRulesetImport: () => void;
}

let abortController: AbortController | null = null;
/** 评测运行独立的取消句柄：与对话互不影响 */
let evalAbortController: AbortController | null = null;

// ── Evaluation persistence (localStorage; cases are small and per-device) ──
const EVAL_CASES_KEY = 'promptstudio:evalCases';
const EVAL_ROLE_KEY = 'promptstudio:evalPromptRole';

function persistEvalCases(cases: EvalCase[]): void {
  try {
    localStorage.setItem(EVAL_CASES_KEY, JSON.stringify(cases));
  } catch {
    // quota / private mode — keep in memory only
  }
}

function loadEvalCases(): EvalCase[] {
  try {
    const raw = localStorage.getItem(EVAL_CASES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EvalCase[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadEvalPromptRole(): 'system' | 'user' {
  try {
    return localStorage.getItem(EVAL_ROLE_KEY) === 'user' ? 'user' : 'system';
  } catch {
    return 'system';
  }
}

/** 评测对象：优先当前打开的文件，否则主文档 */
function getEvalTemplate(state: {
  docContent: string;
  editingFilePath: string | null;
  importedFiles: ImportedFileInfo[];
}): string {
  if (state.editingFilePath) {
    const file = state.importedFiles.find(f => f.path === state.editingFilePath);
    if (file) return file.content;
  }
  return state.docContent;
}
/** 联动检查/文件校验的防抖定时器 */
const syncCheckTimer: { current: ReturnType<typeof setTimeout> | null } = { current: null };
/** 最近一次打开的编辑目标（localStorage 持久化：刷新后恢复） */
const LAST_EDIT_KEY = 'promptstudio:lastEditingFile';
/** 新手指引弹窗是否已关闭（跳过/完成） */
const ONBOARDED_KEY = 'promptstudio:onboarded';

function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return false;
  }
}

function saveLastEditing(path: string | null): void {
  try {
    localStorage.setItem(LAST_EDIT_KEY, JSON.stringify({ path }));
  } catch {
    // ignore quota/security errors
  }
}

function loadLastEditing(): string | null | undefined {
  try {
    const raw = localStorage.getItem(LAST_EDIT_KEY);
    if (!raw) return undefined; // 无记录 = 首次
    const parsed = JSON.parse(raw) as { path: string | null };
    return parsed.path;
  } catch {
    return undefined;
  }
}
let validationTimer: ReturnType<typeof setTimeout> | null = null;

const DEFAULT_SYSTEM_PROMPT = `You are an expert prompt engineer. The user will ask you to modify a prompt/skill document.

OUTPUT FORMAT (MUST follow EXACTLY, no exceptions):
1. First, output the COMPLETE modified document wrapped in a markdown code fence:
\`\`\`markdown
<COMPLETE modified document content here — include the entire document, frontmatter, all sections>
\`\`\`
2. Then, output a JSON block with modification explanations:
\`\`\`json-explanations
{
  "blocks": [
    {
      "id": "block-1",
      "type": "replaced",
      "why": "Reason for this change",
      "how": "How it was modified",
      "effect": "Expected impact",
      "oldSnippet": "original text",
      "newSnippet": "new text"
    }
  ]
}
\`\`\`

STRICT RULES:
- Output ONLY the markdown fence and the JSON block. NO other text, NO commentary, NO analysis, NO summaries before or after.
- The document inside the fence must be COMPLETE and directly reusable: same structure as the original, with all modifications applied.
- Do NOT wrap the document in any other formatting. Do NOT explain your changes outside the JSON block.`;

/** Resolve the active ruleset: built-in + custom merged lookup (P0-1 / P1-5). */
function getActiveRuleset(state: { rulesetId: string; customRulesets: RuleSet[] }): RuleSet | undefined {
  return findRuleset(state.rulesetId, state.customRulesets);
}

export const useStore = create<AppState>((set, get) => ({
  // ── Initial State ──
  docId: 'doc-default',
  docName: 'untitled-prompt.md',
  docContent: SAMPLE_DOC,
  candidateContent: null,
  rulesetId: 'anthropic-skill',

  validationIssues: [],
  showValidationBanner: false,
  showValidationPanel: true,

  selectedText: '',
  pendingJumpLine: null,

  chatMessages: [],
  isStreaming: false,
  streamingContent: '',
  streamingReasoning: '',
  contextMode: 'full',
  showReasoning: true,

  diffActive: false,
  diffLeftLines: [],
  diffRightLines: [],
  changeBlocks: [],
  currentChangeIdx: -1,
  ignoreWhitespace: false,
  ignoreReorder: false,

  modLogOpen: false,
  modLogPinned: false,
  modLogChangeIdx: -1,

  versions: [],

  settingsOpen: false,
  settingsSection: 'models',
  themeMode: loadThemeMode(),
  toolbarStyle: loadToolbarStyle(),
  activeTour: null,
  selectedProviderId: 'deepseek',
  selectedModelName: 'deepseek-flash',
  apiKeyInput: '',
  baseUrlOverride: '',
  connectionStatus: 'idle',
  connectionMessage: '',

  workspaceScopes: [],
  currentScopeId: null,
  importedFiles: [],
  editingFilePath: null,
  showWelcome: false,
  showOnboarding: false,
  fileSnapshots: {},
  scopeSyncIssues: [],
  fileValidationIssues: [],
  diffQueue: null,
  currentDiffFileIdx: 0,

  chatReference: null,
  pendingChatInput: null,

  sensitiveTerms: [],
  maskEnabled: false,
  maskRegistry: null,

  localFolder: null,
  localFiles: [],

  organizePreview: null,
  customRulesets: [],
  pendingReferences: [],
  rulesetImportOpen: false,

  activeView: 'editor',

  evalCases: [],
  evalSelectedCaseId: null,
  evalPromptRole: 'system',
  evalRunning: false,
  evalResults: null,
  evalRuns: [],
  evalError: null,
  evalTargetVersionId: null,
  evalCurrentRunId: null,

  // ── Actions ──

  init: async () => {
    // 官网入口（?first=1）：「新人首次使用」演示模式 —— 跳过一切历史恢复，
    // 使用独立 docId 隔离写入，绝不触碰真实数据；本会话的新操作落在演示文档上。
    // 判断放在 init 内部（而非 App 侧重置），规避 StrictMode 双 init 的恢复竞态。
    const firstRunDemo = typeof location !== 'undefined'
      && new URLSearchParams(location.search).get('first') === '1';
    if (firstRunDemo) {
      // 必须在加载任何持久化配置（模型/Key/脱敏词）之前就返回：
      // 否则设备上已保存的供应商/Key 会“泄漏”进演示模式，破坏“全新首次使用”的效果。
      set({ docId: 'doc-demo-firstrun', showOnboarding: true, showWelcome: true });
      get().runValidation();
      return;
    }

    // Load model config
    const stored = loadModelConfig();
    if (stored) {
      set({
        selectedProviderId: stored.providerId,
        selectedModelName: stored.modelName,
        baseUrlOverride: stored.baseUrlOverride || '',
      });
      const key = await getApiKey(stored.providerId);
      if (key) {
        set({ apiKeyInput: maskApiKey(key) });
      }
    }

    // 脱敏配置（设备级，本地持久化）
    try {
      const terms = localStorage.getItem('promptstudio:sensitiveTerms');
      if (terms) set({ sensitiveTerms: JSON.parse(terms) as string[] });
      set({ maskEnabled: localStorage.getItem('promptstudio:maskEnabled') === '1' });
    } catch {
      // ignore
    }

    // 恢复上次授权的本地文件夹句柄（不弹权限框；need-auth 时由 UI 引导）
    await get().restoreLocalFolder();

    // 评测用例（设备级）+ 历史运行
    const storedCases = loadEvalCases();
    set({
      evalCases: storedCases,
      evalSelectedCaseId: storedCases[0]?.id ?? null,
      evalPromptRole: loadEvalPromptRole(),
    });
    void get().loadEvalRuns();

    // Create default doc if not exists
    const docId = get().docId;
    let existing = await db.docs.get(docId);
    if (!existing) {
      const now = Date.now();
      const doc: PromptDoc = {
        id: docId,
        name: get().docName,
        content: get().docContent,
        formatType: 'skill',
        rulesetId: get().rulesetId,
        createdAt: now,
        updatedAt: now,
      };
      await saveDoc(doc);

      // Create initial version
      await saveVersion({
        docId,
        versionNumber: 1,
        label: 'v1',
        content: get().docContent,
        parentId: null,
        changeBlocks: [],
        note: '初始版本',
        createdAt: now,
        summaryStatus: 'none',
      });
    } else {
      set({
        docContent: existing.content,
        docName: existing.name,
        rulesetId: existing.rulesetId,
      });
    }

    // Load versions
    await get().loadVersions();

    // Load chat session
    const chatSession = await getChatSession(docId);
    if (chatSession) {
      set({ chatMessages: chatSession.messages });
    }

    // Load custom rulesets (P1-5)
    await get().loadCustomRulesets();

    // Load persisted workspace scopes + imported files (P1-9)
    try {
      const [scopes, imports] = await Promise.all([
        getWorkspaceScopes(get().docId),
        getImportedFiles(get().docId),
      ]);
      set({ workspaceScopes: scopes, importedFiles: imports });

      // 首次打开（未完成过新手指引）→ 弹窗强提醒（可跳过）
      if (!hasOnboarded()) {
        set({ showOnboarding: true });
      }

      // 恢复最近一次打开的编辑目标（刷新后展示上次编辑的内容）
      const last = loadLastEditing();
      if (last === undefined) {
        set({ showWelcome: true }); // 首次打开 → 引导欢迎页
      } else if (last !== null) {
        if (imports.some(f => f.path === last)) {
          get().setEditingFile(last);
        } else {
          set({ showWelcome: true }); // 记录的文件已被删除
        }
      }
      // last === null → 最近编辑的是主文档，保持默认（主文档展示）
    } catch (err) {
      console.error('加载工作区/导入文件失败', err);
    }

    // Run initial validation
    get().runValidation();
  },

  setDocContent: (content: string) => {
    set({ docContent: content });

    // Debounced validation
    if (validationTimer) clearTimeout(validationTimer);
    validationTimer = setTimeout(() => {
      get().runValidation();
    }, 500);
  },

  setSelectedText: (text: string) => {
    set({ selectedText: text });
  },

  setShowValidationPanel: (show: boolean) => set({ showValidationPanel: show }),

  toggleValidationPanel: () => set(s => ({ showValidationPanel: !s.showValidationPanel })),

  runValidation: () => {
    const { docContent } = get();
    const ruleset = getActiveRuleset(get());
    if (!ruleset) return;

    const issues = validate(docContent, ruleset);
    set({ validationIssues: issues, showValidationBanner: issues.some(i => i.severity === 'error') });
  },

  // P0-1: switch ruleset, re-validate, persist to the doc record.
  setRuleset: async (id: string) => {
    set({ rulesetId: id });
    get().runValidation();
    // 文件模式下同步重跑当前文件的校验（否则规则集切换后文件校验结果陈旧）
    if (get().editingFilePath) get().runFileValidation();
    try {
      await db.docs.update(get().docId, { rulesetId: id });
    } catch (err) {
      console.error('规则集持久化失败', err);
      toast('规则集选择未能持久化', 'error');
    }
  },

  // P0-3: one-shot jump intent consumed by the editor.
  jumpToLine: (line: number) => {
    set({ pendingJumpLine: line });
  },

  // P1-3: compute the organized result but only preview it; user confirms.
  doAutoOrganize: () => {
    const { docContent } = get();
    const ruleset = getActiveRuleset(get());
    if (!ruleset) return;

    const organized = autoOrganize(docContent, ruleset);
    if (organized === docContent) {
      toast('模块顺序已符合规则集要求', 'info');
      return;
    }
    const before = findModules(docContent).map(m => m.name);
    const after = findModules(organized).map(m => m.name);
    set({ organizePreview: { before, after, result: organized } });
  },

  setOrganizePreviewAfter: (after: string[]) => {
    const preview = get().organizePreview;
    if (!preview) return;
    set({ organizePreview: { ...preview, after } });
  },

  confirmAutoOrganize: async () => {
    const preview = get().organizePreview;
    if (!preview) return;
    set({ organizePreview: null });
    // 拖拽自定义排序：按用户调整后的 after 顺序重新生成结果；
    // 未拖拽时 after 即自动整理顺序，结果与预生成 result 等价。
    const reordered = reorderModules(get().docContent, preview.after);
    await get().createVersion('自动整理模块顺序', reordered, []);
  },

  cancelAutoOrganize: () => {
    set({ organizePreview: null });
  },

  // ── Chat Actions ──

  sendChatMessage: async (text: string) => {
    const state = get();
    if (state.isStreaming) return;

    // P0-4: incremental mode requires an explicit editor selection — fail loudly
    // instead of silently degrading to the first 500 chars.
    if (state.contextMode === 'incremental' && !state.selectedText) {
      toast('未选中内容：增量模式需要先在编辑器中圈选区块', 'error');
      return;
    }

    // Get provider template
    const providerId = state.selectedProviderId;
    const template = getTemplate(providerId);
    if (!template) {
      set({ connectionMessage: '未找到供应商模板' });
      return;
    }

    const needsKey = template.auth.type !== 'none';
    const apiKey = needsKey ? await getApiKey(providerId) : '';
    if (needsKey && !apiKey) {
      set({ settingsOpen: true, connectionMessage: '请先配置 API Key' });
      return;
    }

    const baseUrl = state.baseUrlOverride || template.baseUrl;

    // P1-8: reference prepend lives in the action (hoisted from ChatPanel)
    // so programmatic sends (selection quick actions) get the same citation.
    let userText = text;
    if (state.chatReference) {
      const quoted = state.chatReference.text.split('\n').map(l => `> ${l}`).join('\n');
      userText = `> 📎 ${state.chatReference.sourceLabel}\n${quoted}\n\n${text}`;
      set({ chatReference: null });
    }

    // 脱敏：构建会话级映射表（AI 全程不可见原文，只看到编号）
    const maskReg = get().buildSessionMaskRegistry();
    const maskCount = maskReg?.byId.size ?? 0;
    if (maskCount > 0) {
      toast(`已脱敏 ${maskCount} 处敏感数据（编号替换，AI 不可见原文）`, 'info');
    }

    // Build context（内容源已按映射表统一脱敏）
    const contextMessages = buildContextMessages(state, userText, maskReg);

    // P1-11: report confirmed references actually injected into context
    const confirmedRefs = state.pendingReferences.filter(r => r.status === 'confirmed');
    if (confirmedRefs.length > 0) {
      const totalTokens = confirmedRefs.reduce((sum, r) => sum + r.tokenEst, 0);
      toast(`已注入 ${confirmedRefs.length} 个引用文件（约 ${totalTokens} tokens）`, 'info');
    }

    // 本地消息气泡保留原文展示（持久化在本地设备）；AI 侧 payload 已由 buildContextMessages 脱敏
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };

    const placeholderMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now() + 1,
      modelId: state.selectedModelName,
    };

    set({
      chatMessages: [...state.chatMessages, userMsg, placeholderMsg],
      isStreaming: true,
      streamingContent: '',
      streamingReasoning: '',
    });

    abortController = new AbortController();

    let fullText = '';
    let fullReasoning = '';

    try {
      await sendMessage({
        template: { ...template, baseUrl },
        apiKey,
        model: state.selectedModelName,
        messages: contextMessages,
        signal: abortController.signal,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        callbacks: {
          onToken: (token: string) => {
            fullText += token;
            set({ streamingContent: fullText });
            // Update placeholder message
            const msgs = get().chatMessages;
            const updated = msgs.map(m =>
              m.id === placeholderMsg.id ? { ...m, content: fullText } : m
            );
            set({ chatMessages: updated });
          },
          onReasoning: (token: string) => {
            fullReasoning += token;
            set({ streamingReasoning: fullReasoning });
            const msgs = get().chatMessages;
            const updated = msgs.map(m =>
              m.id === placeholderMsg.id ? { ...m, content: fullText, reasoning: fullReasoning } : m
            );
            set({ chatMessages: updated });
          },
          onDone: (finalText: string) => {
            const finalContent = finalText || fullText;

            // Parse for change explanations
            const { content, changeBlocks } = parseAIResponse(finalContent);

            const msgs = get().chatMessages;
            const updated = msgs.map(m =>
              m.id === placeholderMsg.id ? {
                ...m,
                content: content,
                reasoning: fullReasoning,
                rawResponse: finalContent,
                changeBlocks,
                tokens: estimateTokens(content),
                costEst: estimateCost(state.selectedModelName, estimateTokens(contextMessages.map(m => m.content).join('')), estimateTokens(content)),
              } : m
            );

            set({
              chatMessages: updated,
              isStreaming: false,
              streamingContent: '',
              streamingReasoning: '',
              // P1-11: clear pending references after a successful send
              pendingReferences: [],
            });

            // Persist chat
            const session = {
              id: `chat-${get().docId}`,
              docId: get().docId,
              messages: updated,
              contextConfig: {
                scope: get().contextMode,
                includeRules: true,
                includeIterationSummary: true,
              },
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            saveChatSession(session);
          },
          onError: (error: Error) => {
            const msgs = get().chatMessages;
            const updated = msgs.map(m =>
              m.id === placeholderMsg.id ? { ...m, content: `❌ ${error.message}` } : m
            );
            set({ chatMessages: updated, isStreaming: false });
          },
        },
      });
    } catch (err) {
      const msgs = get().chatMessages;
      const errorMsg = err instanceof Error ? err.message : String(err);
      const updated = msgs.map(m =>
        m.id === placeholderMsg.id ? { ...m, content: `❌ ${errorMsg}` } : m
      );
      set({ chatMessages: updated, isStreaming: false });
    }
  },

  stopStreaming: () => {
    abortController?.abort();
    abortController = null;
    set({ isStreaming: false });
  },

  applyAsCandidate: (messageId: string) => {
    const { chatMessages, editingFilePath, importedFiles, fileSnapshots } = get();
    const msg = chatMessages.find(m => m.id === messageId);
    if (!msg || !msg.rawResponse) return;

    // Extract the CLEAN complete document for diff comparison
    // (strips commentary, analysis, code fences, JSON blocks)
    const rawContent = extractDocumentFromResponse(msg.rawResponse);
    // 脱敏还原：AI 看到的是编号，这里按会话映射表换回真实内容（AI 只做菜，不知给谁做）
    const reg = get().maskRegistry;
    const content = reg ? unmaskText(rawContent, reg) : rawContent;

    // 文件模式：应用到当前打开的文件（写回 importedFiles，快照保持为「修改前」用于 diff 对比）
    if (editingFilePath) {
      const file = importedFiles.find(f => f.path === editingFilePath);
      if (!file || !content || content.trim() === file.content.trim()) {
        window.dispatchEvent(new CustomEvent('toast', {
          detail: { message: '⚠️ 无法从 AI 回复中提取修改后文档，请重新生成', type: 'error' },
        }));
        return;
      }
      set(state => ({
        importedFiles: state.importedFiles.map(f => f.path === editingFilePath ? { ...f, content } : f),
        fileSnapshots: fileSnapshots[editingFilePath] !== undefined
          ? fileSnapshots
          : { ...fileSnapshots, [editingFilePath]: file.content },
      }));
      if (file.localPath) {
        void get().writeBackLocalFile(file.localPath, content);
      } else {
        saveImportedFile(get().docId, { ...file, content }).catch(err => {
          console.error('导入文件持久化失败', err);
        });
      }

      const updated = chatMessages.map(m =>
        m.id === messageId ? { ...m, appliedAsCandidate: true } : m
      );
      set({ chatMessages: updated });
      get().openDiff();
      return;
    }

    if (!content || content.trim() === get().docContent.trim()) {
      window.dispatchEvent(new CustomEvent('toast', {
        detail: { message: '⚠️ 无法从 AI 回复中提取修改后文档，请重新生成', type: 'error' },
      }));
      return;
    }
    set({ candidateContent: content });

    // Update message to mark as applied
    const updated = chatMessages.map(m =>
      m.id === messageId ? { ...m, appliedAsCandidate: true } : m
    );
    set({ chatMessages: updated });

    // Open diff view
    get().openDiff();
  },

  setContextMode: (mode: 'full' | 'incremental') => {
    set({ contextMode: mode });
  },

  /** 发版前重置：清空 IndexedDB + 本地配置（localStorage），回到全新首次使用状态 */
  resetAllData: async () => {
    try {
      await clearAllData();
    } catch (err) {
      console.error('重置 IndexedDB 失败', err);
    }
    try {
      const keys = Object.keys(localStorage).filter(k =>
        k.startsWith('promptstudio:') || k.startsWith('ps_') || k === 'ps_model_config'
      );
      keys.forEach(k => localStorage.removeItem(k));
    } catch {
      // ignore
    }
    location.reload();
  },

  // ── Local Folder actions ──

  /** 用户授权选择本地文件夹（需手势），并列出文件树 */
  pickLocalFolder: async () => {
    const info = await pickFolder();
    if (!info) return;
    set({ localFolder: info, localFiles: [] });
    await get().refreshLocalFiles();
  },

  /** 打开网页时恢复上次授权目录（不弹框；状态 need-auth 时由 UI 引导重新授权） */
  restoreLocalFolder: async () => {
    const info = await restoreFolder();
    if (!info) return;
    set({ localFolder: info });
    if (info.permission === 'granted') {
      await get().refreshLocalFiles();
    }
  },

  /** 重新请求权限（用户手势内调用） */
  reauthorizeLocalFolder: async () => {
    const cur = get().localFolder;
    if (!cur) return;
    const updated = await requestLocalFolderPermission(cur);
    set({ localFolder: updated });
    if (updated.permission === 'granted') {
      await get().refreshLocalFiles();
    }
  },

  /** 刷新本地文件树（授权目录内） */
  refreshLocalFiles: async () => {
    const cur = get().localFolder;
    if (!cur || cur.permission !== 'granted') return;
    const nodes = await listLocalFiles(cur.handle);
    set({ localFiles: nodes });
  },

  /** 打开本地文件：读取内容 → 进入 importedFiles（local:// 前缀，内容不落库）→ 打开编辑器 */
  openLocalFile: async (path: string) => {
    const cur = get().localFolder;
    if (!cur || cur.permission !== 'granted') return;
    const handle = findLocalFileHandle(get().localFiles, path);
    if (!handle) return;
    const content = await readLocalFile(handle);
    const key = `local://${cur.name}/${path}`;
    const info: ImportedFileInfo = {
      name: path.split('/').pop() || path,
      path: key,
      content,
      importedAt: Date.now(),
      localPath: path,
    };
    set(state => ({
      importedFiles: [...state.importedFiles.filter(f => f.path !== key), info],
    }));
    get().setEditingFile(key);
    set({ activeView: 'editor' }); // 从工作区打开本地文件 → 切回编辑器视图
  },

  /** 写回本地文件（编辑保存 / diff 接受后落盘） */
  writeBackLocalFile: async (path: string, content: string) => {
    const cur = get().localFolder;
    if (!cur || cur.permission !== 'granted') return;
    const handle = findLocalFileHandle(get().localFiles, path);
    if (!handle) return;
    try {
      await writeLocalFile(handle, content);
    } catch (err) {
      console.error('[localFiles] 写回失败', err);
      toast('本地文件写回失败，请检查授权状态', 'error');
    }
  },

  // ── Sensitive Data Sanitization actions ──
  setSensitiveTerms: (terms: string[]) => {
    set({ sensitiveTerms: terms });
    try {
      localStorage.setItem('promptstudio:sensitiveTerms', JSON.stringify(terms));
    } catch {
      // ignore
    }
  },

  setMaskEnabled: (enabled: boolean) => {
    set({ maskEnabled: enabled });
    try {
      localStorage.setItem('promptstudio:maskEnabled', enabled ? '1' : '0');
    } catch {
      // ignore
    }
  },

  /** 基于当前文档集构建会话级映射表（AI 不可见原文；多文档全局同编号） */
  buildSessionMaskRegistry: () => {
    const state = get();
    if (!state.maskEnabled) {
      set({ maskRegistry: null });
      return null;
    }
    const sources = [
      state.docContent,
      ...state.importedFiles.map(f => f.content),
      ...state.workspaceScopes.flatMap(s => s.modules.filter(m => m.selected).map(m => m.heading)),
    ];
    const tokens = collectSensitiveTokens(sources, state.sensitiveTerms, BUILTIN_RULES);
    const reg = tokens.size > 0 ? buildMaskRegistry(tokens) : null;
    set({ maskRegistry: reg });
    return reg;
  },

  toggleReasoning: () => {
    set({ showReasoning: !get().showReasoning });
  },

  // ── Diff Actions ──

  openDiff: () => {
    const {
      docContent, docName, candidateContent, editingFilePath,
      importedFiles, fileSnapshots, ignoreWhitespace, ignoreReorder,
    } = get();

    // 构建 diff 多文件队列：主文档（有候选时）+ 内容发生修改的编辑文件（快照 ≠ 当前）
    const queue: { key: string; label: string; left: string; right: string }[] = [];
    if (candidateContent) {
      queue.push({ key: '', label: docName, left: docContent, right: candidateContent });
    }
    for (const f of importedFiles) {
      const snap = fileSnapshots[f.path];
      if (snap !== undefined && snap !== f.content) {
        queue.push({ key: f.path, label: f.name, left: snap, right: f.content });
      }
    }
    if (queue.length === 0) return;

    // 若当前正在编辑某文件且有该文件的修改，优先从该文件开始对比
    let startIdx = 0;
    if (editingFilePath) {
      const i = queue.findIndex(q => q.key === editingFilePath);
      if (i >= 0) startIdx = i;
    }

    const target = queue[startIdx];
    const { leftLines, rightLines, changeBlocks } = buildDiffLines(
      target.left,
      target.right,
      { ignoreWhitespace, ignoreReorder }
    );

    // Merge with any existing explanations from the AI response
    const lastAssistantMsg = [...get().chatMessages].reverse().find(m => m.role === 'assistant' && m.changeBlocks);
    if (lastAssistantMsg?.changeBlocks) {
      changeBlocks.forEach((cb) => {
        const matching = lastAssistantMsg.changeBlocks?.find(ec =>
          ec.oldSnippet === cb.oldSnippet || ec.newSnippet === cb.newSnippet
        );
        if (matching?.explanation) {
          cb.explanation = matching.explanation;
          cb.pendingConfirmation = false;
        } else {
          cb.pendingConfirmation = true;
        }
        // P1-2: fill mod-log metadata from the source assistant message
        cb.modelId = lastAssistantMsg.modelId;
        cb.tokens = lastAssistantMsg.tokens;
        cb.costEst = lastAssistantMsg.costEst;
      });
    } else {
      changeBlocks.forEach(cb => { cb.pendingConfirmation = true; });
    }

    set({
      diffActive: true,
      diffQueue: queue,
      currentDiffFileIdx: startIdx,
      diffLeftLines: leftLines,
      diffRightLines: rightLines,
      changeBlocks,
      currentChangeIdx: changeBlocks.length > 0 ? 0 : -1,
    });

    // Run validation on candidate
    const ruleset = getActiveRuleset(get());
    if (ruleset) {
      const issues = validate(target.right, ruleset);
      set({ showValidationBanner: issues.some(i => i.severity === 'error') });
    }
  },

  closeDiff: () => {
    const { changeBlocks } = get();
    const unresolved = changeBlocks.filter(b => b.accepted === null).length;
    if (unresolved > 0) {
      if (!confirm(`还有 ${unresolved} 处修改未处理。确定退出对比？`)) return;
    }
    set({ diffActive: false, modLogOpen: false, diffQueue: null, currentDiffFileIdx: 0 });
  },

  acceptChange: (idx: number) => {
    const blocks = [...get().changeBlocks];
    if (idx < 0 || idx >= blocks.length) return;
    blocks[idx] = { ...blocks[idx], accepted: true };
    set({ changeBlocks: blocks });
    get().checkAllResolved();
  },

  rejectChange: (idx: number) => {
    const blocks = [...get().changeBlocks];
    if (idx < 0 || idx >= blocks.length) return;
    blocks[idx] = { ...blocks[idx], accepted: false };
    set({ changeBlocks: blocks });
    get().checkAllResolved();
  },

  acceptAll: () => {
    const blocks = get().changeBlocks;
    if (!confirm(`确定接受全部 ${blocks.length} 处修改？`)) return;
    set({ changeBlocks: blocks.map(b => ({ ...b, accepted: true })) });
    get().checkAllResolved();
  },

  rejectAll: () => {
    const blocks = get().changeBlocks;
    if (!confirm('确定拒绝全部修改？')) return;
    set({ changeBlocks: blocks.map(b => ({ ...b, accepted: false })) });
    get().checkAllResolved();
  },

  nextChange: () => {
    const { changeBlocks } = get();
    if (changeBlocks.length === 0) return;
    const nextIdx = (get().currentChangeIdx + 1) % changeBlocks.length;
    set({ currentChangeIdx: nextIdx });
    scrollDiffToChange(nextIdx);
  },

  prevChange: () => {
    const { changeBlocks } = get();
    if (changeBlocks.length === 0) return;
    const prevIdx = (get().currentChangeIdx - 1 + changeBlocks.length) % changeBlocks.length;
    set({ currentChangeIdx: prevIdx });
    scrollDiffToChange(prevIdx);
  },

  setIgnoreWhitespace: (val: boolean) => {
    set({ ignoreWhitespace: val });
    if (get().diffActive) get().openDiff();
  },

  // P1-1: toggle reorder detection; rerun diff when active (same pattern as whitespace).
  setIgnoreReorder: (val: boolean) => {
    set({ ignoreReorder: val });
    if (get().diffActive) get().openDiff();
  },

  setModLogChange: (idx: number) => {
    set({ modLogChangeIdx: idx, currentChangeIdx: idx });
  },

  toggleModLog: (open?: boolean) => {
    set(state => ({
      modLogOpen: open !== undefined ? open : !state.modLogOpen,
    }));
  },

  togglePin: () => {
    set(state => ({ modLogPinned: !state.modLogPinned }));
  },

  // ── Settings Actions ──

  openSettings: async (section = 'models') => {
    const stored = loadModelConfig();
    if (stored) {
      set({
        selectedProviderId: stored.providerId,
        selectedModelName: stored.modelName,
        baseUrlOverride: stored.baseUrlOverride || '',
      });
      const key = await getApiKey(stored.providerId);
      if (key) set({ apiKeyInput: maskApiKey(key) });
    }
    set({ settingsOpen: true, settingsSection: section, connectionStatus: 'idle', connectionMessage: '' });
  },

  setSettingsSection: (section) => set({ settingsSection: section }),

  setThemeMode: (mode) => {
    persistThemeMode(mode);
    applyTheme(mode);
    set({ themeMode: mode });
  },

  setToolbarStyle: (style) => {
    persistToolbarStyle(style);
    applyToolbarStyle(style);
    set({ toolbarStyle: style });
  },

  startTour: (id) => {
    // 自动引导只出现一次；重播不受影响
    try { localStorage.setItem(`promptstudio:tour:${id}`, '1'); } catch { /* ignore */ }
    set({ activeTour: id });
  },

  endTour: () => set({ activeTour: null }),

  closeSettings: () => set({ settingsOpen: false }),

  // 顶栏模型胶囊：不打开设置弹窗，直接切换并持久化（同时把该供应商已保存的 Key 载入内存）
  quickSwitchModel: async (providerId, modelName) => {
    const template = getTemplate(providerId);
    const name = modelName.trim();
    if (!template || !name) return;

    const state = get();
    const sameProvider = providerId === state.selectedProviderId;
    const keepTypedKey = sameProvider && !!state.apiKeyInput && !state.apiKeyInput.includes('•');
    const storedKey = template.auth.type === 'none' ? '' : await getApiKey(providerId);
    const baseUrlOverride = sameProvider ? state.baseUrlOverride : '';

    set({
      selectedProviderId: providerId,
      selectedModelName: name,
      baseUrlOverride,
      apiKeyInput: keepTypedKey ? state.apiKeyInput : (storedKey ? maskApiKey(storedKey) : ''),
    });

    saveModelConfig({
      providerId,
      modelName: name,
      baseUrlOverride,
      configured: !!storedKey || keepTypedKey || template.auth.type === 'none',
    });
    toast(`已切换到 ${template.name} · ${name}`, 'success');
  },

  loadProviderKeyStatus: async () => {
    const providers = [...PROVIDER_TEMPLATES, CUSTOM_TEMPLATE];
    const entries = await Promise.all(providers.map(async p => {
      if (p.auth.type === 'none') return [p.providerId, true] as const;
      try {
        const key = await getApiKey(p.providerId);
        return [p.providerId, !!key] as const;
      } catch {
        return [p.providerId, false] as const;
      }
    }));
    return Object.fromEntries(entries) as Record<string, boolean>;
  },

  setProvider: (id: string) => {
    const template = getTemplate(id);
    const prev = get().selectedProviderId;
    const keepTypedKey = prev === id ? get().apiKeyInput : '';
    set({
      selectedProviderId: id,
      selectedModelName: template?.defaultModels[0] || '',
      baseUrlOverride: '',
      apiKeyInput: keepTypedKey,
    });

    // 切到另一家时把已保存的 Key 载回内存（打码），否则界面会误显示「未配置」
    if (prev !== id) {
      void getApiKey(id).then(key => {
        const state = get();
        if (state.selectedProviderId === id && state.apiKeyInput === '') {
          set({ apiKeyInput: key ? maskApiKey(key) : '' });
        }
      });
    }
  },

  setModelName: (name: string) => set({ selectedModelName: name }),
  setApiKeyInput: (key: string) => set({ apiKeyInput: key }),
  setBaseUrlOverride: (url: string) => set({ baseUrlOverride: url }),

  doTestConnection: async () => {
    const { selectedProviderId, selectedModelName, apiKeyInput, baseUrlOverride } = get();
    const template = getTemplate(selectedProviderId);
    if (!template) return;

    // Get actual key (might be masked); providers with auth 'none' (本地端点) skip.
    let apiKey = apiKeyInput;
    if (apiKeyInput.includes('•')) {
      apiKey = await getApiKey(selectedProviderId);
    }
    if (!apiKey && template.auth.type !== 'none') {
      set({ connectionStatus: 'error', connectionMessage: '请输入 API Key' });
      return;
    }

    set({ connectionStatus: 'testing', connectionMessage: '测试中...' });

    const baseUrl = baseUrlOverride || template.baseUrl;
    const result = await testConnection(
      { ...template, baseUrl },
      apiKey,
      selectedModelName
    );

    set({
      connectionStatus: result.success ? 'success' : 'error',
      connectionMessage: result.message,
    });
  },

  doSaveSettings: async () => {
    const { selectedProviderId, selectedModelName, baseUrlOverride, apiKeyInput } = get();
    const modelName = selectedModelName.trim();

    // 空模型名保存后会让对话/评测直接 400，先在设置页拦住
    if (!modelName) {
      set({ connectionStatus: 'error', connectionMessage: '请先选择或输入模型名称' });
      return;
    }

    // API Key 三态：
    // - 输入了新 Key（非空且未打码）→ AES-256-GCM 加密保存
    // - 输入仍是打码值（未改动）→ 保持已存 Key 不动
    // - 输入已清空 → 删除已保存的 Key（修复「删了还显示已配置」）
    if (apiKeyInput && !apiKeyInput.includes('•')) {
      await saveApiKey(selectedProviderId, apiKeyInput);
    } else if (!apiKeyInput) {
      deleteApiKey(selectedProviderId);
    }

    // Save model config
    saveModelConfig({
      providerId: selectedProviderId,
      modelName,
      baseUrlOverride,
      configured: !!apiKeyInput && !apiKeyInput.includes('•'),
    });

    set({ selectedModelName: modelName, settingsOpen: false });
  },

  // ── Version Actions ──

  loadVersions: async () => {
    const versions = await getVersions(get().docId);
    set({ versions });
  },

  createVersion: async (note: string, content: string, changeBlocks: ChangeBlock[] = []) => {
    const { docId, versions } = get();
    const versionNumber = (versions[0]?.versionNumber || 0) + 1;

    // P1-2: backfill version range metadata onto change blocks
    const versionFrom = versions[0]?.label ?? 'v0';
    const versionTo = `v${versionNumber}`;
    const stampedBlocks = changeBlocks.map(cb => ({ ...cb, versionFrom, versionTo }));

    await saveVersion({
      docId,
      versionNumber,
      label: versionTo,
      content,
      parentId: versions[0]?.id || null,
      changeBlocks: stampedBlocks,
      note,
      createdAt: Date.now(),
      summaryStatus: 'none',
    });

    // Update doc content
    set({ docContent: content });
    const doc = await db.docs.get(docId);
    if (doc) {
      doc.content = content;
      doc.updatedAt = Date.now();
      await saveDoc(doc);
    }

    await get().loadVersions();
    get().runValidation();
  },

  rollbackToVersion: async (versionId: string) => {
    const version = get().versions.find(v => v.id === versionId);
    if (!version) return;

    // Rollback creates a new version with old content
    await get().createVersion(`回滚至 ${version.label}`, version.content, []);
  },

  renameVersion: async (versionId: string, name: string) => {
    await db.versions.update(versionId, { note: name });
    await get().loadVersions();
  },

  exportVersion: (versionId: string) => {
    const version = get().versions.find(v => v.id === versionId);
    if (!version) return null;
    return exportVersionMarkdown(version);
  },

  checkAllResolved: () => {
    const { changeBlocks, candidateContent, docContent, diffQueue, currentDiffFileIdx } = get();
    if (changeBlocks.length === 0) return;
    if (changeBlocks.every(b => b.accepted !== null)) {
      const accepted = changeBlocks.filter(b => b.accepted).length;

      // 文件 diff：把接受的修改应用到对应文件内容
      const cur = diffQueue?.[currentDiffFileIdx];
      if (cur && cur.key !== '' && accepted > 0) {
        const finalContent = applyChanges(cur.left, cur.right, changeBlocks, {
          ignoreReorder: get().ignoreReorder,
        });
        set(state => ({
          importedFiles: state.importedFiles.map(f => f.path === cur.key ? { ...f, content: finalContent } : f),
        }));
      }

      // 多文件队列：一个文件对比完 → 自动切换到下一个文件
      if (diffQueue && currentDiffFileIdx < diffQueue.length - 1) {
        const next = diffQueue[currentDiffFileIdx + 1];
        toast(`「${cur?.label ?? ''}」已处理完毕，自动切换到「${next.label}」`, 'info');
        get().setDiffFile(currentDiffFileIdx + 1);
        return;
      }

      // 多文件队列最后一步：全部完成
      if (diffQueue && diffQueue.length > 1) {
        toast(`全部 ${diffQueue.length} 个文件的对比处理完毕`, 'success');
        get().closeDiff();
        return;
      }

      // 单文件（主文档）：原逻辑——版本确认
      setTimeout(() => {
        if (confirm(`所有修改已处理完毕。\n\n已接受：${accepted} 处\n已拒绝：${changeBlocks.length - accepted} 处\n\n生成新版本？`)) {
          const finalContent = applyChanges(docContent, candidateContent || '', changeBlocks, {
            ignoreReorder: get().ignoreReorder,
          });
          get().createVersion(
            `AI 修改（接受 ${accepted}/${changeBlocks.length}）`,
            finalContent,
            changeBlocks
          );
          get().closeDiff();
        }
      }, 300);
    }
  },

  // ── Navigation ──
  setActiveView: (view: 'editor' | 'chat' | 'history' | 'workspace' | 'ruleset' | 'eval') => {
    set({ activeView: view });
    if (view === 'eval' || view === 'history') {
      void get().loadEvalRuns();
      if (view === 'eval' && get().evalCases.length === 0) {
        set({ evalCases: loadEvalCases(), evalPromptRole: loadEvalPromptRole() });
      }
    }
  },

  // ── Evaluation Actions (P0-1) ──
  addEvalCase: () => {
    const state = get();
    const template = getEvalTemplate(state);
    const c: EvalCase = {
      id: makeId('case'),
      name: `用例 ${state.evalCases.length + 1}`,
      input: '',
      vars: scaffoldVars(template),
      asserts: [{ id: makeId('as'), type: 'contains', value: '' }],
    };
    const next = [...state.evalCases, c];
    persistEvalCases(next);
    set({ evalCases: next, evalSelectedCaseId: c.id });
  },

  updateEvalCase: (id, patch) => {
    const next = get().evalCases.map(c => (c.id === id ? { ...c, ...patch } : c));
    persistEvalCases(next);
    set({ evalCases: next });
  },

  setEvalCaseVar: (id, key, value) => {
    const next = get().evalCases.map(c =>
      c.id === id ? { ...c, vars: { ...c.vars, [key]: value } } : c
    );
    persistEvalCases(next);
    set({ evalCases: next });
  },

  addEvalCaseVar: (id, key) => {
    const trimmed = key.trim();
    if (!trimmed) return;
    const next = get().evalCases.map(c =>
      c.id === id && !(trimmed in c.vars) ? { ...c, vars: { ...c.vars, [trimmed]: '' } } : c
    );
    persistEvalCases(next);
    set({ evalCases: next });
  },

  removeEvalCaseVar: (id, key) => {
    const next = get().evalCases.map(c => {
      if (c.id !== id) return c;
      const vars = { ...c.vars };
      delete vars[key];
      return { ...c, vars };
    });
    persistEvalCases(next);
    set({ evalCases: next });
  },

  removeEvalCase: (id) => {
    const next = get().evalCases.filter(c => c.id !== id);
    persistEvalCases(next);
    set({
      evalCases: next,
      evalSelectedCaseId: get().evalSelectedCaseId === id ? (next[0]?.id ?? null) : get().evalSelectedCaseId,
    });
  },

  duplicateEvalCase: (id) => {
    const src = get().evalCases.find(c => c.id === id);
    if (!src) return;
    const copy: EvalCase = {
      ...src,
      id: makeId('case'),
      name: `${src.name}（副本）`,
      vars: { ...src.vars },
      asserts: src.asserts.map(a => ({ ...a, id: makeId('as') })),
    };
    const next = [...get().evalCases, copy];
    persistEvalCases(next);
    set({ evalCases: next, evalSelectedCaseId: copy.id });
  },

  selectEvalCase: (id) => set({ evalSelectedCaseId: id }),

  addEvalAssertion: (caseId, type = 'contains') => {
    const next = get().evalCases.map(c =>
      c.id === caseId
        ? { ...c, asserts: [...c.asserts, { id: makeId('as'), type, value: '', ...(type === 'llm-rubric' ? { threshold: 0.7 } : {}) }] }
        : c
    );
    persistEvalCases(next);
    set({ evalCases: next });
  },

  updateEvalAssertion: (caseId, assertionId, patch) => {
    const next = get().evalCases.map(c =>
      c.id === caseId
        ? { ...c, asserts: c.asserts.map(a => (a.id === assertionId ? { ...a, ...patch } : a)) }
        : c
    );
    persistEvalCases(next);
    set({ evalCases: next });
  },

  removeEvalAssertion: (caseId, assertionId) => {
    const next = get().evalCases.map(c =>
      c.id === caseId ? { ...c, asserts: c.asserts.filter(a => a.id !== assertionId) } : c
    );
    persistEvalCases(next);
    set({ evalCases: next });
  },

  setEvalPromptRole: (role) => {
    try {
      localStorage.setItem(EVAL_ROLE_KEY, role);
    } catch {
      // ignore
    }
    set({ evalPromptRole: role });
  },

  importEvalConfig: (text) => {
    const { config, error } = parseEvalConfig(text);
    if (!config || error) {
      toast(`配置解析失败：${error ?? '未知错误'}`, 'error');
      return false;
    }
    persistEvalCases(config.cases);
    set({
      evalCases: config.cases,
      evalPromptRole: config.promptRole ?? 'system',
      evalSelectedCaseId: config.cases[0]?.id ?? null,
      evalResults: null,
    });
    toast(`已导入 ${config.cases.length} 个用例`, 'success');
    return true;
  },

  loadExampleEvalCases: () => {
    get().importEvalConfig(exampleEvalConfig());
  },

  exportEvalConfig: () => stringifyEvalConfig(get().evalPromptRole, get().evalCases),

  runEval: async () => {
    const state = get();
    if (state.evalRunning) return;

    if (state.evalCases.length === 0) {
      toast('请先添加至少一个评测用例', 'error');
      return;
    }

    // P1-2: 指定版本时评测历史内容，否则评测当前文档 / 打开的文件
    const targetVersion = state.evalTargetVersionId
      ? state.versions.find(v => v.id === state.evalTargetVersionId)
      : undefined;
    if (state.evalTargetVersionId && !targetVersion) {
      set({ evalTargetVersionId: null });
      toast('目标版本已不存在，已切回当前文档', 'error');
    }

    const templateText = targetVersion ? targetVersion.content : getEvalTemplate(state);
    if (!templateText.trim()) {
      toast(targetVersion ? `${targetVersion.label} 内容为空，无法评测` : '当前文档为空，没有可评测的提示词', 'error');
      return;
    }

    const template = getTemplate(state.selectedProviderId);
    if (!template) {
      toast('未找到模型供应商模板', 'error');
      return;
    }

    const needsKey = template.auth.type !== 'none';
    const apiKey = needsKey ? await getApiKey(state.selectedProviderId) : '';
    if (needsKey && !apiKey) {
      set({ settingsOpen: true, connectionMessage: '请先配置 API Key' });
      return;
    }

    const baseUrl = state.baseUrlOverride || template.baseUrl;
    const startedAt = Date.now();
    const docName = state.editingFilePath
      ? (state.importedFiles.find(f => f.path === state.editingFilePath)?.name ?? state.docName)
      : state.docName;

    // P1-2b: 快照在开跑时冻结，运行中编辑用例不会污染这次结果
    const casesSnapshot = cloneCases(state.evalCases);

    evalAbortController = new AbortController();
    set({ evalRunning: true, evalResults: [], evalError: null });

    try {
      const results = await runEvalCases({
        template: templateText,
        promptRole: state.evalPromptRole,
        cases: casesSnapshot,
        target: {
          providerId: state.selectedProviderId,
          template: { ...template, baseUrl },
          apiKey,
          model: state.selectedModelName,
        },
        signal: evalAbortController.signal,
        concurrency: 3,
        onCaseDone: (result) => {
          set({ evalResults: [...(get().evalResults ?? []), result] });
        },
      });

      const passed = results.filter(r => r.passed).length;
      set({ evalResults: results });

      // 版本绑定：显式指定 > 主文档内容与最新版本一致 > 未版本化
      // （文件模式下不绑定主文档版本：文件内容即使碰巧相同也不是那个版本）
      const latest = state.versions[0];
      const boundVersion = targetVersion
        ?? (!state.editingFilePath && latest && latest.content.trim() === templateText.trim() ? latest : undefined);

      const run: EvalRun = {
        id: makeId('run'),
        docId: state.docId,
        docName,
        providerId: state.selectedProviderId,
        modelName: state.selectedModelName,
        promptRole: state.evalPromptRole,
        promptSnapshot: templateText,
        createdAt: startedAt,
        durationMs: Date.now() - startedAt,
        total: results.length,
        passed,
        cases: results,
        versionId: boundVersion?.id ?? null,
        versionLabel: boundVersion?.label ?? '未版本化',
        versionNumber: boundVersion?.versionNumber,
        score: scoreRun({ passed, total: results.length }),
        dataset: casesSnapshot,
        datasetHash: datasetHash(casesSnapshot),
      };
      await saveEvalRun(run);
      set({ evalCurrentRunId: run.id });
      await get().loadEvalRuns();
      toast(
        `评测完成：${passed}/${results.length} 通过` + (boundVersion ? ` · ${boundVersion.label}` : ''),
        passed === results.length ? 'success' : 'info'
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        toast('评测已取消', 'info');
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        set({ evalError: msg });
        toast(`评测失败：${msg}`, 'error');
      }
    } finally {
      evalAbortController = null;
      // 目标版本只对本次运行生效：避免用户下次改动后误以为在评测当前内容
      set({ evalRunning: false, evalTargetVersionId: null });
    }
  },

  runEvalForVersion: async (versionId) => {
    const version = get().versions.find(v => v.id === versionId);
    if (!version) {
      toast('版本不存在，请刷新后重试', 'error');
      return;
    }
    if (get().evalRunning) return;
    set({ evalTargetVersionId: versionId, evalError: null, activeView: 'eval' });
    await get().runEval();
  },

  clearEvalTargetVersion: () => set({ evalTargetVersionId: null }),

  cancelEval: () => {
    evalAbortController?.abort();
  },

  clearEvalResults: () => set({ evalResults: null, evalError: null, evalCurrentRunId: null }),

  loadEvalRuns: async () => {
    try {
      const runs = await getEvalRuns(get().docId, 100);
      set({ evalRuns: runs });
    } catch {
      // DB unavailable (private mode) — keep the in-memory run list empty
    }
  },

  viewEvalRun: (id) => {
    const run = get().evalRuns.find(r => r.id === id);
    if (run) set({ evalResults: run.cases, evalError: null, evalCurrentRunId: run.id });
  },

  restoreEvalSnapshot: (runId) => {
    const run = get().evalRuns.find(r => r.id === runId);
    const snapshot = run?.dataset;
    if (!run || !snapshot || snapshot.length === 0) {
      toast('这次运行没有用例快照（旧版本运行记录）', 'error');
      return false;
    }

    const current = get().evalCases;
    const runHash = run.datasetHash ?? datasetHash(snapshot);
    if (current.length > 0 && datasetHash(current) !== runHash) {
      const ok = confirm(
        `当前用例集与「${run.versionLabel ?? '该运行'}」的快照不同。\n\n` +
        `载入将替换当前 ${current.length} 条用例，确定？`
      );
      if (!ok) return false;
    }

    const cases = cloneCases(snapshot);
    persistEvalCases(cases);
    set({ evalCases: cases, evalSelectedCaseId: cases[0]?.id ?? null });
    toast(`已载入 ${cases.length} 条用例（${run.versionLabel ?? '未版本化'} 运行）`, 'success');
    return true;
  },

  // ── Workspace Actions ──
  // All mutations are write-through: memory first, then async persist (P1-9).

  parseDocumentModules: () => {
    return parseModulesFromContent(get().docContent);
  },

  createScope: (name: string, description: string, modules: ScopeModule[]) => {
    const scope: WorkspaceScope = {
      id: `ws-${Date.now()}`,
      name,
      description,
      modules,
      expanded: true,
      locked: false,
      applied: false,
      createdAt: Date.now(),
    };
    set(state => ({
      workspaceScopes: [...state.workspaceScopes, scope],
      currentScopeId: scope.id,
    }));
    persistScope(get().docId, scope);
    return scope.id;
  },

  deleteScope: (id: string) => {
    const target = get().workspaceScopes.find(s => s.id === id);
    if (target?.locked) {
      toast('已锁定的工作区需先解锁才能删除', 'error');
      return;
    }
    set(state => ({
      workspaceScopes: state.workspaceScopes.filter(s => s.id !== id),
      currentScopeId: state.currentScopeId === id ? null : state.currentScopeId,
    }));
    deleteWorkspaceScope(id).catch(err => {
      console.error('删除工作区持久化失败', err);
      toast('工作区删除未能持久化', 'error');
    });
  },

  toggleModuleInScope: (scopeId: string, moduleHeading: string) => {
    // 锁定守卫：锁定后子集元素不可修改，解锁后方可重新编辑
    const target = get().workspaceScopes.find(s => s.id === scopeId);
    if (target?.locked) return;
    set(state => ({
      workspaceScopes: state.workspaceScopes.map(s =>
        s.id === scopeId
          ? { ...s, modules: s.modules.map(m => m.heading === moduleHeading ? { ...m, selected: !m.selected } : m) }
          : s
      ),
    }));
    persistScopeById(get(), scopeId);
  },

  toggleScopeExpanded: (scopeId: string) => {
    set(state => ({
      workspaceScopes: state.workspaceScopes.map(s =>
        s.id === scopeId ? { ...s, expanded: !s.expanded } : s
      ),
    }));
    persistScopeById(get(), scopeId);
  },

  toggleScopeLocked: (scopeId: string) => {
    set(state => ({
      workspaceScopes: state.workspaceScopes.map(s =>
        s.id === scopeId ? { ...s, locked: !s.locked } : s
      ),
    }));
    persistScopeById(get(), scopeId);
  },

  toggleScopeApplied: (scopeId: string) => {
    set(state => ({
      workspaceScopes: state.workspaceScopes.map(s =>
        s.id === scopeId ? { ...s, applied: !s.applied } : s
      ),
    }));
    persistScopeById(get(), scopeId);
  },

  selectScope: (id: string | null) => {
    set({ currentScopeId: id });
  },

  selectAllModules: (scopeId: string) => {
    // 锁定守卫：锁定后子集元素不可修改
    const target = get().workspaceScopes.find(s => s.id === scopeId);
    if (target?.locked) return;
    set(state => ({
      workspaceScopes: state.workspaceScopes.map(s =>
        s.id === scopeId
          ? { ...s, modules: s.modules.map(m => ({ ...m, selected: true })) }
          : s
      ),
    }));
    persistScopeById(get(), scopeId);
  },

  deselectAllModules: (scopeId: string) => {
    // 锁定守卫：锁定后子集元素不可修改
    const target = get().workspaceScopes.find(s => s.id === scopeId);
    if (target?.locked) return;
    set(state => ({
      workspaceScopes: state.workspaceScopes.map(s =>
        s.id === scopeId
          ? { ...s, modules: s.modules.map(m => ({ ...m, selected: false })) }
          : s
      ),
    }));
    persistScopeById(get(), scopeId);
  },

  addFilesToScope: (scopeId: string, paths: string[]) => {
    set(state => {
      const target = state.workspaceScopes.find(s => s.id === scopeId);
      if (!target || target.locked) return {};
      const existingHeadings = new Set(target.modules.map(m => m.heading));
      const newModules: ScopeModule[] = [];
      for (const p of paths) {
        const file = state.importedFiles.find(f => f.path === p);
        if (!file) continue;
        for (const m of parseModulesFromContent(file.content)) {
          const heading = `${file.name}/${m.heading}`;
          if (existingHeadings.has(heading)) continue;
          existingHeadings.add(heading);
          newModules.push({ ...m, heading, selected: true, locked: false });
        }
      }
      if (newModules.length === 0) return {};
      return {
        workspaceScopes: state.workspaceScopes.map(s =>
          s.id === scopeId ? { ...s, modules: [...s.modules, ...newModules], expanded: true } : s
        ),
      };
    });
    persistScopeById(get(), scopeId);
    toast('已添加至工作区', 'success');
  },

  // ── 文件编辑模式（点击导入文件 → 编辑区展示） ──

  setEditingFile: (path: string | null) => {
    if (path === null) {
      // 返回主文档
      set({ editingFilePath: null, showWelcome: false, scopeSyncIssues: [], fileValidationIssues: [] });
      saveLastEditing(null);
      return;
    }
    const file = get().importedFiles.find(f => f.path === path);
    if (!file) return;
    // 首次打开记录内容快照（用于「对比」修改前后）
    set(state => ({
      editingFilePath: path,
      showWelcome: false,
      fileSnapshots: state.fileSnapshots[path] !== undefined
        ? state.fileSnapshots
        : { ...state.fileSnapshots, [path]: file.content },
      scopeSyncIssues: [],
    }));
    saveLastEditing(path);
    get().checkScopeSync();
    get().runFileValidation();
  },

  updateImportedFileContent: (path: string, content: string) => {
    set(state => ({
      importedFiles: state.importedFiles.map(f => f.path === path ? { ...f, content } : f),
    }));
    const file = get().importedFiles.find(f => f.path === path);
    if (file) {
      if (file.localPath) {
        // 本地授权文件夹文件：内容不落库，直接写回本地
        void get().writeBackLocalFile(file.localPath, content);
      } else {
        saveImportedFile(get().docId, file).catch(err => {
          console.error('导入文件持久化失败', err);
        });
      }
    }
    // 防抖：内容变化后联动检查 + 文件校验（500ms）
    if (syncCheckTimer.current) clearTimeout(syncCheckTimer.current);
    syncCheckTimer.current = setTimeout(() => {
      if (get().editingFilePath === path) {
        get().checkScopeSync();
        get().runFileValidation();
      }
    }, 500);
  },

  checkScopeSync: () => {
    const { editingFilePath, importedFiles, workspaceScopes } = get();
    if (!editingFilePath) {
      set({ scopeSyncIssues: [] });
      return;
    }
    const file = importedFiles.find(f => f.path === editingFilePath);
    if (!file) {
      set({ scopeSyncIssues: [] });
      return;
    }
    // 包含该文件的范围（模块 heading 带「文件名/」前缀）
    const scopes = workspaceScopes.filter(s => s.modules.some(m => m.heading.startsWith(`${file.name}/`)));
    if (scopes.length === 0) {
      set({ scopeSyncIssues: [] });
      return;
    }
    // 范围内涉及的文件名集合
    const scopeFileNames = new Set<string>();
    for (const s of scopes) {
      for (const m of s.modules) {
        const slash = m.heading.indexOf('/');
        if (slash > 0) scopeFileNames.add(m.heading.slice(0, slash));
      }
    }
    const issues: ScopeSyncIssue[] = [];
    const fileModuleHeadings = parseModulesFromContent(file.content).map(m => m.heading);
    for (const other of importedFiles) {
      if (other.path === editingFilePath) continue;
      if (!scopeFileNames.has(other.name)) continue; // 仅检查同范围文件
      // 文件级引用：other 内容中提及当前文件名/路径
      const mentions = detectPathMentions(other.content);
      const hit = mentions.some(mt => matchImportedFiles(mt, [file]).some(x => x.confidence === 'exact'));
      if (hit) {
        issues.push({
          filePath: other.path,
          fileLabel: other.name,
          kind: 'file',
          matchedName: file.name,
          reason: `内容中引用了「${file.name}」，需同步检查引用逻辑`,
        });
      }
      // 模块级引用：other 内容中出现当前文件的模块标题
      for (const h of fileModuleHeadings) {
        if (h.length > 2 && other.content.includes(h)) {
          issues.push({
            filePath: other.path,
            fileLabel: other.name,
            kind: 'module',
            matchedName: h,
            reason: `内容中引用了模块「${h}」，需同步检查`,
          });
        }
      }
    }
    set({ scopeSyncIssues: issues });
  },

  runFileValidation: () => {
    const { editingFilePath, importedFiles } = get();
    const file = importedFiles.find(f => f.path === editingFilePath);
    const ruleset = getActiveRuleset(get());
    if (!file || !ruleset) {
      set({ fileValidationIssues: [] });
      return;
    }
    set({ fileValidationIssues: validate(file.content, ruleset) });
  },

  setDiffFile: (idx: number) => {
    const { diffQueue, ignoreWhitespace, ignoreReorder } = get();
    if (!diffQueue || idx < 0 || idx >= diffQueue.length) return;
    const target = diffQueue[idx];
    const { leftLines, rightLines, changeBlocks } = buildDiffLines(target.left, target.right, {
      ignoreWhitespace,
      ignoreReorder,
    });
    set({
      currentDiffFileIdx: idx,
      diffLeftLines: leftLines,
      diffRightLines: rightLines,
      changeBlocks,
      currentChangeIdx: -1,
      modLogOpen: false,
    });
  },

  dismissOnboarding: () => {
    try {
      localStorage.setItem(ONBOARDED_KEY, '1');
    } catch {
      // ignore
    }
    set({ showOnboarding: false });
  },

  importFile: async (file: File) => {
    const text = await file.text();
    // Determine relative path: if file has webkitRelativePath, use it; otherwise just name
    const relativePath = (file as any).webkitRelativePath || file.name;
    const info: ImportedFileInfo = {
      name: file.name,
      path: relativePath,
      content: text,
      importedAt: Date.now(),
    };
    set(state => ({
      importedFiles: [...state.importedFiles.filter(f => f.path !== relativePath), info],
    }));
    saveImportedFile(get().docId, info).catch(err => {
      console.error('导入文件持久化失败', err);
      toast('导入文件未能持久化', 'error');
    });
  },

  importFolder: async (files: File[]) => {
    const newFiles: ImportedFileInfo[] = [];
    for (const file of files) {
      const text = await file.text();
      const relativePath = (file as any).webkitRelativePath || file.name;
      newFiles.push({
        name: file.name,
        path: relativePath,
        content: text,
        importedAt: Date.now(),
      });
    }
    set(state => {
      const existing = new Map(state.importedFiles.map(f => [f.path, f]));
      for (const nf of newFiles) existing.set(nf.path, nf);
      return { importedFiles: Array.from(existing.values()) };
    });
    const docId = get().docId;
    for (const nf of newFiles) {
      saveImportedFile(docId, nf).catch(err => {
        console.error('导入文件持久化失败', err);
        toast('导入文件未能持久化', 'error');
      });
    }
  },

  removeImportedFile: (path: string) => {
    set(state => ({
      importedFiles: state.importedFiles.filter(f => f.path !== path),
      // 删除的是当前编辑文件 → 回到主文档并清记录
      editingFilePath: state.editingFilePath === path ? null : state.editingFilePath,
      scopeSyncIssues: state.editingFilePath === path ? [] : state.scopeSyncIssues,
    }));
    if (get().editingFilePath === null && loadLastEditing() === path) {
      saveLastEditing(null);
    }
    deleteImportedFile(path).catch(err => {
      console.error('删除导入文件持久化失败', err);
      toast('导入文件删除未能持久化', 'error');
    });
  },

  // P1-9: aggregate modules from checked imported files into a new scope,
  // headings named as `文件名/标题`.
  createScopeFromFiles: (paths: string[], name: string, description: string = '') => {
    const { importedFiles } = get();
    const modules: ScopeModule[] = [];
    for (const p of paths) {
      const file = importedFiles.find(f => f.path === p);
      if (!file) continue;
      for (const m of parseModulesFromContent(file.content)) {
        modules.push({ ...m, heading: `${file.name}/${m.heading}`, selected: true, locked: false });
      }
    }
    return get().createScope(name, description, modules);
  },

  // ── Chat Reference ──

  setChatReference: (ref: ChatReference | null) => {
    set({ chatReference: ref });
  },

  clearChatReference: () => {
    set({ chatReference: null });
  },

  setPendingChatInput: (text: string | null) => {
    set({ pendingChatInput: text });
  },

  // ── Selection toolbar quick actions (P1-8) ──
  // ask / fix    → attach a reference chip + prefill the chat input, wait for the user.
  // explain / improve → auto-send immediately with the structured reference (📎) embedded.
  selectionQuickAction: (action: SelectionQuickActionType, payload: SelectionActionPayload) => {
    const state = get();

    // 1. Build the source label
    let sourceLabel: string;
    if (payload.source === 'editor') {
      const start = payload.startLine ?? 1;
      const end = payload.endLine ?? start;
      const modules = parseModulesFromContent(state.docContent);
      const mod = modules.find(m => start >= m.startLine && start <= m.endLine);
      const heading = mod ? `${'#'.repeat(mod.level)} ${mod.heading}` : '编辑器选区';
      sourceLabel = `${heading} (L${start}-${end})`;
    } else if (payload.source === 'diff-left') {
      sourceLabel = '修改前（左）';
    } else {
      sourceLabel = '修改后（右）';
    }

    // 2. Structured reference block (same shape ChatPanel uses in handleSend)
    const quoted = payload.text.split('\n').map(l => `> ${l}`).join('\n');
    const referenceMessage = `> 📎 ${sourceLabel}\n${quoted}`;

    // 3. Preset instructions, wording ported from the legacy js/selection-toolbar.js prompts table
    const instructions: Record<SelectionQuickActionType, string> = {
      ask: `请针对以上从${sourceLabel}选中的内容，回答我的问题：`,
      explain: `请解释以上从${sourceLabel}选中的 Prompt/Skill 内容的含义和设计意图。`,
      improve: `请优化以上从${sourceLabel}选中的内容，使其更清晰、更符合 Prompt Engineering 最佳实践（如使用祈使句、明确输出格式、减少歧义等），并说明你的修改理由：`,
      fix: `请检查以上从${sourceLabel}选中的内容是否存在问题（如歧义、格式错误、规则冲突等），并给出修正建议：`,
    };
    const instruction = instructions[action];

    // 4. Ensure the chat panel is visible
    if (state.activeView !== 'editor' && state.activeView !== 'chat') {
      set({ activeView: 'editor' });
    }

    if (action === 'explain' || action === 'improve') {
      // Auto-send with the structured reference embedded in the message
      void get().sendChatMessage(`${referenceMessage}\n\n${instruction}`);
    } else {
      // ask / fix: set the reference chip + prefill the input, wait for the user to add details
      const start = payload.startLine ?? 1;
      set({
        chatReference: {
          text: payload.text,
          sourceLabel,
          startLine: start,
          endLine: payload.endLine ?? start,
        },
        pendingChatInput: instruction,
      });
    }

    const sourceName = payload.source === 'editor' ? '编辑器' : sourceLabel;
    toast(`已从${sourceName}选中 ${payload.text.length} 字符 → AI 对话`, 'info');
  },

  // ── Ruleset Import Modal (P1-5 UI) ──

  openRulesetImport: () => set({ rulesetImportOpen: true }),

  closeRulesetImport: () => set({ rulesetImportOpen: false }),

  // ── Custom Rulesets (P1-5) ──

  loadCustomRulesets: async () => {
    try {
      set({ customRulesets: await getCustomRulesets() });
    } catch (err) {
      console.error('加载自定义规则集失败', err);
    }
  },

  saveCustomRuleset: async (rs: RuleSet) => {
    set(state => ({
      customRulesets: [...state.customRulesets.filter(r => r.id !== rs.id), rs],
    }));
    try {
      await saveRuleset(rs);
    } catch (err) {
      console.error('规则集持久化失败', err);
      toast('自定义规则集保存失败', 'error');
    }
  },

  removeCustomRuleset: async (id: string) => {
    set(state => ({ customRulesets: state.customRulesets.filter(r => r.id !== id) }));
    try {
      await deleteRuleset(id);
    } catch (err) {
      console.error('规则集删除持久化失败', err);
      toast('自定义规则集删除未能持久化', 'error');
    }
    // Fall back to the default ruleset when the active one is deleted
    if (get().rulesetId === id) {
      await get().setRuleset('anthropic-skill');
    }
  },

  // ── Version Summary (P1-10, deterministic synthesis) ──

  generateVersionSummary: async (versionId: string) => {
    const version = await db.versions.get(versionId);
    if (!version) return;
    // Second open is instant: reuse persisted summary.
    if (version.summaryStatus === 'ready' && version.summaryBrief) return;

    await updateVersionSummary(versionId, { summaryStatus: 'generating' });
    await get().loadVersions();

    const blocks = version.changeBlocks || [];
    const summaryBrief = blocks.length > 0
      ? blocks.slice(0, 5).map(cb =>
          `${CHANGE_TYPE_ICONS[cb.type] || '•'} ${cb.explanation?.why?.slice(0, 60) || cb.newSnippet.slice(0, 60) || cb.oldSnippet.slice(0, 60)}`
        )
      : ['本版本无变更块记录'];

    const summaryDetail = blocks.length > 0
      ? blocks.map((cb, i) => {
          const lines = [`### ${i + 1}. ${CHANGE_TYPE_ICONS[cb.type] || '•'} [${cb.type}]`];
          if (cb.explanation) {
            lines.push(`- **Why**: ${cb.explanation.why}`);
            lines.push(`- **How**: ${cb.explanation.how}`);
            lines.push(`- **Effect**: ${cb.explanation.effect}`);
          } else {
            lines.push(`- 变更内容: ${(cb.newSnippet || cb.oldSnippet).slice(0, 120)}`);
          }
          return lines.join('\n');
        }).join('\n\n')
      : '本版本无变更块记录。';

    await updateVersionSummary(versionId, {
      summaryBrief,
      summaryDetail,
      summaryStatus: 'ready',
    });
    await get().loadVersions();
  },

  // ── Workspace Reference Search (P1-11) ──

  detectReferences: (text: string) => {
    const mentions = detectPathMentions(text);
    const { importedFiles, pendingReferences } = get();
    const next: PendingReference[] = [];
    const seenPaths = new Set<string>();

    for (const mention of mentions) {
      const best = matchImportedFiles(mention, importedFiles)[0];
      if (!best || seenPaths.has(best.file.path)) continue;
      seenPaths.add(best.file.path);
      // Preserve an existing entry's status across re-detection
      const existing = pendingReferences.find(r => r.file.path === best.file.path);
      next.push({
        id: existing?.id || `ref-${Date.now()}-${next.length}`,
        mention,
        file: best.file,
        confidence: best.confidence,
        status: existing?.status || 'pending',
        tokenEst: estimateTokens(best.file.content),
      });
    }

    set({ pendingReferences: next });
  },

  confirmReference: (id: string) => {
    set(state => ({
      pendingReferences: state.pendingReferences.map(r =>
        r.id === id ? { ...r, status: 'confirmed' as const } : r
      ),
    }));
  },

  dismissReference: (id: string) => {
    set(state => ({
      pendingReferences: state.pendingReferences.map(r =>
        r.id === id ? { ...r, status: 'dismissed' as const } : r
      ),
    }));
  },
}));

// ── Workspace persistence helpers (write-through, P1-9) ──
function persistScope(docId: string, scope: WorkspaceScope): void {
  saveWorkspaceScope(docId, scope).catch(err => {
    console.error('工作区持久化失败', err);
    toast('工作区保存失败', 'error');
  });
}

function persistScopeById(state: { docId: string; workspaceScopes: WorkspaceScope[] }, scopeId: string): void {
  const scope = state.workspaceScopes.find(s => s.id === scopeId);
  if (scope) persistScope(state.docId, scope);
}

// ── Change-block type icons for version summaries (P1-10) ──
const CHANGE_TYPE_ICONS: Record<ChangeBlockType, string> = {
  added: '＋',
  removed: '－',
  replaced: '✎',
  reordered: '⇄',
};

// ── Helper: build context messages for AI ──
// registry 非空时所有内容源统一脱敏（编号替换），AI 全程不可见原文
function buildContextMessages(
  state: AppState,
  userText: string,
  registry?: MaskRegistry | null,
): ChatMessagePayload[] {
  const messages: ChatMessagePayload[] = [];
  const ruleset = getActiveRuleset(state);
  const m = (t: string) => (registry ? maskText(t, registry) : t);

  if (state.contextMode === 'full') {
    // Full document context — 文件模式下发送当前打开文件的内容，而非始终固定为主文档
    const activeFile = state.editingFilePath
      ? state.importedFiles.find(f => f.path === state.editingFilePath)
      : undefined;
    const activeLabel = activeFile ? activeFile.name : '当前文档';
    const activeContent = activeFile ? activeFile.content : state.docContent;
    let contextContent = `## ${activeLabel}内容\n\n${m(activeContent)}`;
    if (ruleset) {
      contextContent += `\n\n## 当前规则集\n规则集: ${ruleset.name}\n模块顺序: ${ruleset.orderRules.map(r => r.module).join(' → ')}`;
    }
    messages.push({ role: 'user', content: contextContent });
  } else {
    // Incremental: just selected text + rules summary
    // (entry guard in sendChatMessage ensures selectedText is non-empty)
    let contextContent = `## 选中内容（增量模式）\n\n${m(state.selectedText)}`;
    if (ruleset) {
      contextContent += `\n\n## 规则摘要\n模块顺序: ${ruleset.orderRules.map(r => r.module).join(' → ')}`;
    }
    messages.push({ role: 'user', content: contextContent });
  }

  // P1-11: inject ONLY user-confirmed references (hard constraint)
  for (const ref of state.pendingReferences) {
    if (ref.status === 'confirmed') {
      messages.push({ role: 'user', content: `## 引用文件 ${ref.file.path}\n\n${m(ref.file.content)}` });
    }
  }

  // 工作区：注入「应用到 AI 对话」范围内勾选模块的内容（自由组合 → 一键应用）
  const appliedScopes = state.workspaceScopes.filter(s => s.applied);
  if (appliedScopes.length > 0) {
    const scopeBlocks: string[] = [];
    for (const scope of appliedScopes) {
      const selected = scope.modules.filter(m => m.selected);
      if (selected.length === 0) continue;
      const modBlocks: string[] = [];
      for (const mod of selected) {
        const content = extractScopeModuleContent(state, mod);
        if (content) modBlocks.push(m(content));
      }
      if (modBlocks.length > 0) {
        scopeBlocks.push(`### 工作区范围：${scope.name}\n\n${modBlocks.join('\n\n')}`);
      }
    }
    if (scopeBlocks.length > 0) {
      messages.push({
        role: 'user',
        content: `## 已应用的工作区参考范围\n\n${scopeBlocks.join('\n\n')}\n\n（以上为你在工作区中勾选并应用的范围，处理请求时请优先参考这些内容）`,
      });
    }
  }

  // Add iteration summary if available
  if (state.versions.length > 0 && state.contextMode === 'full') {
    const lastVersion = state.versions[0];
    if (lastVersion.changeBlocks.length > 0) {
      const summary = lastVersion.changeBlocks
        .map(cb => `- [${cb.type}] ${cb.accepted ? '✓' : '✗'} ${m(cb.newSnippet.slice(0, 60))}`)
        .join('\n');
      messages.push({
        role: 'user',
        content: `## 上一轮迭代摘要 (${lastVersion.label})\n${summary}\n\n请避免重复已拒绝的修改。`,
      });
    }
  }

  // Add chat history (last 5 messages)
  const history = state.chatMessages.slice(-5);
  for (const msg of history) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant' && msg.content && !msg.content.startsWith('❌')) {
      messages.push({ role: 'assistant', content: msg.content.slice(0, 500) });
    }
  }

  // Add current user request
  // 用户输入同样脱敏后发送（AI 不可见原文；本地消息气泡保留原文展示）
  messages.push({ role: 'user', content: m(userText) });

  return messages;
}

/**
 * 提取工作区模块的内容文本：
 * - 模块 heading 带「文件名/」前缀 → 从 importedFiles 中取对应文件内容；
 * - 否则为当前文档模块 → 从 docContent 提取。
 * 按 ScopeModule 的 startLine/endLine 截取（1-based）。
 */
function extractScopeModuleContent(
  state: AppState,
  mod: { heading: string; startLine: number; endLine: number }
): string | null {
  const slashIdx = mod.heading.indexOf('/');
  if (slashIdx > 0) {
    const fileName = mod.heading.slice(0, slashIdx);
    const heading = mod.heading.slice(slashIdx + 1);
    const file = state.importedFiles.find(f => f.name === fileName);
    if (!file) return null;
    const mods = parseModulesFromContent(file.content);
    const m = mods.find(x => x.heading === heading);
    if (!m) return null;
    const lines = file.content.split('\n');
    return `#### ${mod.heading}\n\n${lines.slice(m.startLine - 1, m.endLine).join('\n')}`;
  }
  const mods = parseModulesFromContent(state.docContent);
  const m = mods.find(x => x.heading === mod.heading);
  if (!m) return null;
  const lines = state.docContent.split('\n');
  return `#### ${mod.heading}\n\n${lines.slice(m.startLine - 1, m.endLine).join('\n')}`;
}

// ── Helper: parse AI response for content + explanations ──
function parseAIResponse(raw: string): { content: string; changeBlocks: ChangeBlock[] } {
  // Look for JSON explanations block
  const explanationMatch = raw.match(/```json-explanations\s*([\s\S]*?)```/);
  let changeBlocks: ChangeBlock[] = [];

  if (explanationMatch) {
    try {
      const parsed = JSON.parse(explanationMatch[1].trim());
      if (parsed.blocks && Array.isArray(parsed.blocks)) {
        changeBlocks = parsed.blocks.map((b: any, i: number) => ({
          id: b.id || `cb-${i}`,
          type: b.type || 'replaced',
          oldStartLine: 0,
          oldEndLine: 0,
          newStartLine: 0,
          newEndLine: 0,
          oldSnippet: b.oldSnippet || '',
          newSnippet: b.newSnippet || '',
          accepted: null,
          explanation: {
            why: b.why || '',
            how: b.how || '',
            effect: b.effect || '',
          },
        }));
      }
    } catch {
      // JSON parse failed, treat whole response as content
    }
  }

  // content = raw response minus JSON explanations (kept for chat display)
  const content = raw.replace(/```json-explanations\s*[\s\S]*?```/g, '').trim();

  return { content, changeBlocks };
}

/**
 * Extract just the complete modified document from an AI response.
 * Strips JSON explanations, AI commentary, and code fences.
 * Falls back to the raw response stripped of explanations.
 */
function extractDocumentFromResponse(raw: string): string {
  if (!raw) return '';

  // ── Strategy 1: Line-by-line fence parser (handles nested ``` blocks) ──
  // The modified document may itself contain ```json ... ``` blocks.
  // A naive regex with ([\s\S]*?)``` would stop at the FIRST ``` — wrong.
  const fenceDoc = extractFromCodeFence(raw);
  if (fenceDoc) return fenceDoc;

  // ── Strategy 2: Remove JSON explanations block ──
  let cleaned = raw.replace(/```json-explanations\s*[\s\S]*?```/g, '').trim();

  // ── Strategy 3: Locate document by YAML frontmatter ──
  const fmIndex = cleaned.search(/^---\s*\n(?:name|title|description):\s*\S/m);
  if (fmIndex >= 0) {
    cleaned = cleaned.slice(fmIndex);
    // Trim trailing commentary
    cleaned = cleaned
      .replace(/\n{2,}(?:以上是|修改完成|修改完毕|---\s*\n?\s*$)[\s\S]*$/g, '')
      .trim();
    if (cleaned.split('\n').length >= 3) return cleaned;
  }

  // ── Strategy 4: Locate by markdown heading ──
  const hIndex = cleaned.search(/^#\s/m);
  if (hIndex >= 0) {
    cleaned = cleaned.slice(hIndex);
    cleaned = cleaned
      .replace(/\n{2,}(?:以上是|修改完成|修改完毕)[\s\S]*$/g, '')
      .trim();
    if (cleaned.split('\n').length >= 5) return cleaned;
  }

  // ── Strategy 5: Strip common AI commentary prefixes ──
  cleaned = cleaned
    .replace(/^(?:好的[，,、]?|ok[，,、]?|收到[，,、]?|明白了[，,、]?)\s*(?:以下|这|我|根据|按照)[\s\S]*?(?=\n\n|---\n|```|^#\s)/im, '')
    .trim();

  return cleaned;
}

/**
 * Line-by-line code-fence parser that correctly handles nested ``` blocks.
 * Only an untagged ``` on its own line closes the outer document fence;
 * ```json etc. enters a nested fence that must be closed by a deeper ```.
 */
function extractFromCodeFence(raw: string): string | null {
  const lines = raw.split('\n');
  let inDocFence = false;
  let fenceContent: string[] = [];
  let nestedDepth = 0;

  for (const line of lines) {
    const fenceMatch = line.match(/^```(.*)/);

    if (fenceMatch && !inDocFence) {
      // Opening a document fence
      const lang = fenceMatch[1].trim().toLowerCase();
      const isDoc = lang === 'markdown' || lang === 'md' || lang === 'yaml' || lang === 'yml' || lang === '';
      if (isDoc) {
        inDocFence = true;
        fenceContent = [];
        nestedDepth = 0;
      }
      continue;
    }

    if (fenceMatch && inDocFence) {
      const tag = fenceMatch[1].trim();
      if (tag) {
        // Tagged ``` (e.g. ```json) → enters a nested inner fence
        nestedDepth++;
        fenceContent.push(line);
      } else {
        if (nestedDepth > 0) {
          // Closing a nested inner fence, NOT the doc fence
          nestedDepth--;
          fenceContent.push(line);
        } else {
          // Depth = 0 → closes the outer document fence
          const block = fenceContent.join('\n').trim();
          if ((/^---\s*\n/.test(block) || /^#\s/m.test(block)) && block.split('\n').length >= 3) {
            return block;
          }
          inDocFence = false;
        }
      }
      continue;
    }

    if (inDocFence) {
      fenceContent.push(line);
    }
  }

  // Handle case where fence extends to EOF
  if (inDocFence && fenceContent.length >= 3) {
    const block = fenceContent.join('\n').trim();
    if ((/^---\s*\n/.test(block) || /^#\s/m.test(block)) && block.split('\n').length >= 3) {
      return block;
    }
  }

  return null;
}

// ── Helper: scroll to change in diff view ──
function scrollDiffToChange(idx: number) {
  setTimeout(() => {
    const el = document.querySelector(`[data-change-idx="${idx}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 50);
}


