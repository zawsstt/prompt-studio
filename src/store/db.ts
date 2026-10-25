import Dexie, { type Table } from 'dexie';
import type { PromptDoc, Version, ChatSession, ChangeBlock, RuleSet, WorkspaceScope, ImportedFileInfo, EvalRun } from '../types';

export interface VersionRecord {
  id: string;
  docId: string;
  versionNumber: number;
  label: string;
  content: string;
  parentId: string | null;
  changeBlocks: ChangeBlock[];
  note: string;
  createdAt: number;
  summaryBrief?: string[];
  summaryDetail?: string;
  summaryStatus?: 'none' | 'generating' | 'ready';
}

/** Workspace scope persisted per document (P1-9). */
export interface WorkspaceRecord extends WorkspaceScope {
  docId: string;
}

/** Imported file persisted per document; primary key is `path` (P1-9). */
export interface ImportRecord extends ImportedFileInfo {
  docId: string;
}

/** Custom ruleset record with persistence timestamp (P1-5). */
export interface RulesetRecord extends RuleSet {
  createdAt: number;
}

/** Device-level AES-GCM key record; CryptoKey is stored via structured clone (P1-7). */
export interface KeyRecord {
  id: string;
  key: CryptoKey;
}

/** 本地授权文件夹句柄（File System Access API；handle 结构化克隆可存） */
export interface LocalFolderRecord {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  createdAt: number;
}

/**
 * Schema evolution convention:
 * - Version numbers only ever increase; keep ALL historical version() blocks intact.
 * - Additive changes only (new tables / new indexes); never drop fields.
 * - v2 additions: rulesets (P1-5 custom rulesets), workspaces (P1-9 scopes),
 *   imports (P1-9 imported files, path PK), keystore (P1-7 device AES key).
 */
export class PromptStudioDB extends Dexie {
  docs!: Table<PromptDoc, string>;
  versions!: Table<VersionRecord, string>;
  chats!: Table<ChatSession, string>;
  rulesets!: Table<RulesetRecord, string>;
  workspaces!: Table<WorkspaceRecord, string>;
  imports!: Table<ImportRecord, string>;
  keystore!: Table<KeyRecord, string>;
  localFolders!: Table<LocalFolderRecord, string>;
  evalRuns!: Table<EvalRun, string>;

  constructor() {
    super('PromptStudioDB');
    this.version(1).stores({
      docs: 'id, name, rulesetId, updatedAt',
      versions: 'id, docId, versionNumber, createdAt',
      chats: 'id, docId, updatedAt',
    });
    this.version(2).stores({
      docs: 'id, name, rulesetId, updatedAt',
      versions: 'id, docId, versionNumber, createdAt',
      chats: 'id, docId, updatedAt',
      rulesets: 'id, name, createdAt',
      workspaces: 'id, docId, createdAt',
      imports: 'path, docId, importedAt',
      keystore: 'id',
    });
    // v3: 本地授权文件夹句柄（File System Access API，线上发布场景）
    this.version(3).stores({
      docs: 'id, name, rulesetId, updatedAt',
      versions: 'id, docId, versionNumber, createdAt',
      chats: 'id, docId, updatedAt',
      rulesets: 'id, name, createdAt',
      workspaces: 'id, docId, createdAt',
      imports: 'path, docId, importedAt',
      keystore: 'id',
      localFolders: 'id, createdAt',
    });
    // v4: 评测运行记录（P0-1）。一次运行 = 一组 CaseResult 快照，与 docId 关联。
    this.version(4).stores({
      docs: 'id, name, rulesetId, updatedAt',
      versions: 'id, docId, versionNumber, createdAt',
      chats: 'id, docId, updatedAt',
      rulesets: 'id, name, createdAt',
      workspaces: 'id, docId, createdAt',
      imports: 'path, docId, importedAt',
      keystore: 'id',
      localFolders: 'id, createdAt',
      evalRuns: 'id, docId, createdAt',
    });
    // v5: 回归基线（P1-2）——运行记录绑定 versionId，可按版本检索历史分数。
    this.version(5).stores({
      docs: 'id, name, rulesetId, updatedAt',
      versions: 'id, docId, versionNumber, createdAt',
      chats: 'id, docId, updatedAt',
      rulesets: 'id, name, createdAt',
      workspaces: 'id, docId, createdAt',
      imports: 'path, docId, importedAt',
      keystore: 'id',
      localFolders: 'id, createdAt',
      evalRuns: 'id, docId, versionId, createdAt',
    });
  }
}

export const db = new PromptStudioDB();

/** 发版前「重置全部数据」：删除整个 IndexedDB（下次打开自动按 v3 schema 重建） */
export async function clearAllData(): Promise<void> {
  await db.delete();
}

// ── Version operations ──
export async function saveVersion(record: Omit<VersionRecord, 'id'>): Promise<string> {
  const id = `ver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db.versions.add({ ...record, id } as VersionRecord);
  return id;
}

export async function getVersions(docId: string): Promise<VersionRecord[]> {
  return db.versions.where('docId').equals(docId).reverse().sortBy('versionNumber');
}

export async function getLatestVersion(docId: string): Promise<VersionRecord | undefined> {
  const versions = await getVersions(docId);
  return versions[0];
}

export async function updateVersion(id: string, updates: Partial<VersionRecord>): Promise<void> {
  await db.versions.update(id, updates);
}

/** Convenience: persist AI/deterministic summary fields for a version (P1-10). */
export async function updateVersionSummary(
  id: string,
  summary: { summaryBrief?: string[]; summaryDetail?: string; summaryStatus: 'none' | 'generating' | 'ready' }
): Promise<void> {
  await db.versions.update(id, summary);
}

// ── Chat session operations ──
export async function saveChatSession(session: ChatSession): Promise<void> {
  await db.chats.put(session);
}

export async function getChatSession(docId: string): Promise<ChatSession | undefined> {
  return db.chats.where('docId').equals(docId).first();
}

// ── Doc operations ──
export async function saveDoc(doc: PromptDoc): Promise<void> {
  await db.docs.put(doc);
}

export async function getDoc(id: string): Promise<PromptDoc | undefined> {
  return db.docs.get(id);
}

export async function getAllDocs(): Promise<PromptDoc[]> {
  return db.docs.orderBy('updatedAt').reverse().toArray();
}

// ── Custom ruleset operations (P1-5) ──
export async function saveRuleset(ruleset: RuleSet): Promise<void> {
  const existing = await db.rulesets.get(ruleset.id);
  const record: RulesetRecord = { ...ruleset, createdAt: existing?.createdAt ?? Date.now() };
  await db.rulesets.put(record);
}

export async function getCustomRulesets(): Promise<RulesetRecord[]> {
  return db.rulesets.orderBy('createdAt').toArray();
}

export async function deleteRuleset(id: string): Promise<void> {
  await db.rulesets.delete(id);
}

// ── Workspace scope operations (P1-9) ──
export async function saveWorkspaceScope(docId: string, scope: WorkspaceScope): Promise<void> {
  await db.workspaces.put({ ...scope, docId });
}

export async function getWorkspaceScopes(docId: string): Promise<WorkspaceRecord[]> {
  return db.workspaces.where('docId').equals(docId).sortBy('createdAt');
}

export async function deleteWorkspaceScope(id: string): Promise<void> {
  await db.workspaces.delete(id);
}

// ── Imported file operations (P1-9) ──
export async function saveImportedFile(docId: string, file: ImportedFileInfo): Promise<void> {
  await db.imports.put({ ...file, docId });
}

export async function getImportedFiles(docId: string): Promise<ImportRecord[]> {
  return db.imports.where('docId').equals(docId).toArray();
}

export async function deleteImportedFile(path: string): Promise<void> {
  await db.imports.delete(path);
}

// ── Device keystore operations (P1-7) ──
export async function getDeviceKeyRecord(id: string = 'device'): Promise<KeyRecord | undefined> {
  return db.keystore.get(id);
}

export async function saveDeviceKeyRecord(key: CryptoKey, id: string = 'device'): Promise<void> {
  await db.keystore.put({ id, key });
}

// ── Export version as markdown ──
export function exportVersionMarkdown(version: VersionRecord): string {
  const lines: string[] = [
    `# 版本 ${version.label}`,
    ``,
    `> 创建时间: ${new Date(version.createdAt).toLocaleString()}`,
    `> 备注: ${version.note}`,
    ``,
  ];

  if (version.changeBlocks.length > 0) {
    lines.push(`## 变更记录 (${version.changeBlocks.length} 处)`, ``);
    version.changeBlocks.forEach((cb, i) => {
      const status = cb.accepted === true ? '✓ 已接受' : cb.accepted === false ? '✗ 已拒绝' : '⏳ 待处理';
      lines.push(`### ${i + 1}. [${cb.type}] ${status}`, ``);
      if (cb.explanation) {
        lines.push(`- **Why**: ${cb.explanation.why}`);
        lines.push(`- **How**: ${cb.explanation.how}`);
        lines.push(`- **Effect**: ${cb.explanation.effect}`);
        lines.push('');
      }
    });
  }

  lines.push(`---`, ``, `## 文档内容`, ``, '```markdown', version.content, '```');

  return lines.join('\n');
}

// ── Eval run operations (P0-1 / P1-2) ──
export async function saveEvalRun(run: EvalRun): Promise<void> {
  await db.evalRuns.put(run);
}

/** Newest first. Baseline curves need more history than the 4-row list, so callers pass a limit. */
export async function getEvalRuns(docId: string, limit = 100): Promise<EvalRun[]> {
  const runs = await db.evalRuns.where('docId').equals(docId).reverse().sortBy('createdAt');
  return runs.slice(0, limit);
}

export async function deleteEvalRun(id: string): Promise<void> {
  await db.evalRuns.delete(id);
}
