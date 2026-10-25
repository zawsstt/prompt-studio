// ── Evaluation (P0-1): cases, assertions, runs ──

/** Supported assertion kinds. `llm-rubric` is the only non-deterministic one. */
export type AssertionType =
  | 'contains'
  | 'not-contains'
  | 'regex'
  | 'equals'
  | 'json-valid'
  | 'max-latency'
  | 'llm-rubric';

export interface Assertion {
  id: string;
  type: AssertionType;
  /** Substring / pattern / expected value / required JSON paths / max latency in ms / rubric text */
  value: string;
  /** Only for llm-rubric: pass threshold in [0,1], defaults to 0.7 */
  threshold?: number;
  description?: string;
}

export interface EvalCase {
  id: string;
  name: string;
  /** User message sent to the model under test */
  input: string;
  /** Values substituted into `{{var}}` placeholders in the prompt template */
  vars: Record<string, string>;
  asserts: Assertion[];
}

export interface AssertionResult {
  assertionId: string;
  type: AssertionType;
  passed: boolean;
  /** Only for llm-rubric */
  score?: number;
  detail: string;
}

export interface CaseResult {
  caseId: string;
  caseName: string;
  output: string;
  error?: string;
  assertions: AssertionResult[];
  passed: boolean;
  durationMs: number;
  tokensEst: number;
  costEst: number;
}

export interface EvalRun {
  id: string;
  docId: string;
  docName: string;
  providerId: string;
  modelName: string;
  promptRole: 'system' | 'user';
  /** Prompt template as it was at run time (for reproducibility) */
  promptSnapshot: string;
  createdAt: number;
  durationMs: number;
  total: number;
  passed: number;
  cases: CaseResult[];
  /** P1-2 regression baseline: version the prompt snapshot came from. */
  versionId?: string | null;
  /** Display label of the evaluated version, e.g. "v7"; missing = unversioned work. */
  versionLabel?: string;
  versionNumber?: number;
  /** 0-100 pass-rate snapshot (computed at save time; older runs may omit it). */
  score?: number;
  /** P1-2b: exact case set used by this run, so old scores stay reproducible. */
  dataset?: EvalCase[];
  /** Fingerprint of `dataset`; runs with the same hash are 1:1 comparable. */
  datasetHash?: string;
}

/** Parsed evaluation config file (`.yaml` / `.json`). */
export interface EvalConfig {
  promptRole?: 'system' | 'user';
  cases: EvalCase[];
}
