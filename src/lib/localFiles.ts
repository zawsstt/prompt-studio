// ── 本地文件夹授权读取（File System Access API） ──
// 线上发布场景：文件内容永不"上传"，只在本机授权目录内读取/写回，
// 目录句柄持久化于 IndexedDB（Dexie localFolders 表），每次打开网页恢复并重新请求权限。
// 浏览器支持：Chrome / Edge（secure context：https 或 localhost）。

import { db } from '../store/db';

export interface LocalFileNode {
  name: string;
  /** 相对目录根的路径（/ 分隔） */
  path: string;
  kind: 'file' | 'directory';
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
}

export interface LocalFolderInfo {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  /** 授权状态：granted = 本会话可读写；need-auth = 句柄已恢复但需用户重新授权 */
  permission: 'granted' | 'prompt';
}

/** 允许读取的扩展名（资源管理器概念：只看可编辑的文本类文件） */
const ALLOWED_EXT = new Set(['.md', '.markdown', '.txt', '.json', '.yaml', '.yml', '.js', '.ts', '.tsx', '.css', '.html']);
/** 跳过的目录（防深挖） */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'target', '.next', '__pycache__']);

export function isLocalFileApiAvailable(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** 用户授权选择本地文件夹（需用户手势触发），句柄持久化 */
export async function pickLocalFolder(): Promise<LocalFolderInfo | null> {
  if (!isLocalFileApiAvailable()) return null;
  try {
    const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    const info: LocalFolderInfo = {
      id: `folder-${Date.now()}`,
      name: handle.name,
      handle,
      permission: 'granted',
    };
    try {
      await db.localFolders.put({ id: info.id, name: info.name, handle, createdAt: Date.now() });
    } catch (err) {
      // 兜底：句柄无法持久化（如隐私模式）时降级为会话级授权，刷新后需重新授权
      console.warn('[localFiles] 目录句柄持久化失败，降级为会话级授权', err);
    }
    return info;
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return null; // 用户取消
    console.error('[localFiles] 授权文件夹失败', err);
    return null;
  }
}

/** 打开网页时恢复上次授权的目录句柄（不弹权限框，仅探测状态） */
export async function restoreLocalFolder(): Promise<LocalFolderInfo | null> {
  try {
    const rec = await db.localFolders.orderBy('createdAt').reverse().first();
    if (!rec) return null;
    // TS DOM lib 未声明 queryPermission，运行时 Chrome/Edge 均支持
    const permission = await (rec.handle as any).queryPermission({ mode: 'readwrite' });
    return {
      id: rec.id,
      name: rec.name,
      handle: rec.handle,
      permission: permission === 'granted' ? 'granted' : 'prompt',
    };
  } catch (err) {
    console.error('[localFiles] 恢复目录句柄失败', err);
    return null;
  }
}

/** 重新请求权限（必须在用户手势中调用，例如点击「重新授权」） */
export async function requestLocalFolderPermission(info: LocalFolderInfo): Promise<LocalFolderInfo> {
  try {
    const permission = await (info.handle as any).requestPermission({ mode: 'readwrite' });
    return { ...info, permission: permission === 'granted' ? 'granted' : 'prompt' };
  } catch {
    return info;
  }
}

/** 递归列出授权目录内的可编辑文件树 */
export async function listLocalFiles(
  dirHandle: FileSystemDirectoryHandle,
  prefix = '',
): Promise<LocalFileNode[]> {
  const nodes: LocalFileNode[] = [];
  try {
    // @ts-expect-error entries() 在部分 TS lib 未声明
    for await (const [name, handle] of dirHandle.entries()) {
      const path = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === 'directory') {
        if (SKIP_DIRS.has(name)) continue;
        nodes.push({ name, path, kind: 'directory', handle });
        nodes.push(...await listLocalFiles(handle as FileSystemDirectoryHandle, path));
      } else if (handle.kind === 'file') {
        const ext = name.includes('.') ? `.${name.split('.').pop()!.toLowerCase()}` : '';
        if (ALLOWED_EXT.has(ext)) {
          nodes.push({ name, path, kind: 'file', handle: handle as FileSystemFileHandle });
        }
      }
    }
  } catch (err) {
    console.error('[localFiles] 列出目录失败', err);
  }
  return nodes;
}

/** 读取本地文件内容 */
export async function readLocalFile(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

/** 写回本地文件（编辑保存 / diff 接受后落盘） */
export async function writeLocalFile(handle: FileSystemFileHandle, content: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

/** 按相对路径在树中查找文件句柄 */
export function findLocalFileHandle(nodes: LocalFileNode[], path: string): FileSystemFileHandle | null {
  const node = nodes.find(n => n.kind === 'file' && n.path === path);
  return node ? (node.handle as FileSystemFileHandle) : null;
}
