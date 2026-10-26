// ── 敏感数据脱敏引擎（Sensitive Data Sanitizer） ──
// 原则：全程离线本地逻辑，AI 永不接触原文。
// 1. 全局词表：扫描全部文档 → 提取敏感值 → 统一编号（SENS-001…）→ 所有文档同步替换
// 2. 编号占位格式 {{SENS-001}}：不易被 AI 误改，且可正则还原
// 3. 还原容错：AI 可能微调编号格式，unmask 时兼容 {{SENS-001}} / SENS-001 两种形态

export interface SanitizeRuleDef {
  id: string;
  label: string;
  /** 给模型看的短类型标记（不包含原文） */
  shortLabel: string;
  /** 正则源码（无 /g，内部统一加 g） */
  source: string;
}

/** 自定义词条：value 为真实词条（只在本地），label 为可选的类型标记 */
export interface SensitiveTermEntry {
  value: string;
  label: string;
}

/** 内置规则：SQL 底表命名 + 个人信息常见模式 */
export const BUILTIN_RULES: SanitizeRuleDef[] = [
  {
    id: 'sql-table',
    label: 'SQL 底表名（ods_/dwd_/dws_/ads_/dim_/tmp_/stg_ 前缀）',
    shortLabel: 'SQL 底表名',
    source: '\\b(?:ods|dwd|dws|ads|dim|tmp|stg)_[a-zA-Z0-9_]{2,}\\b',
  },
  {
    id: 'phone',
    label: '手机号（1 开头 11 位）',
    shortLabel: '手机号',
    source: '1[3-9]\\d{9}',
  },
  {
    id: 'idcard',
    label: '身份证号（18 位）',
    shortLabel: '身份证号',
    source: '\\b\\d{17}[\\dXx]\\b',
  },
  {
    id: 'email',
    label: '邮箱地址',
    shortLabel: '邮箱',
    source: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
  },
  {
    id: 'ip-internal',
    label: '内网 IP（10./172.16-31./192.168.）',
    shortLabel: '内网 IP',
    source: '\\b(?:10\\.|172\\.(?:1[6-9]|2\\d|3[01])\\.|192\\.168\\.)[0-9]{1,3}\\.[0-9]{1,3}\\b',
  },
];

/** 编号占位格式：编号本身已含 SENS- 前缀，占位 = {{ + 编号 + }} */
export const MASK_PREFIX = '{{';
export const MASK_SUFFIX = '}}';
/** 还原时兼容无括号形态的编号（AI 可能剥离双大括号） */
const UNMASK_RE = /\{\{SENS-(\d{3,})\}\}|SENS-(\d{3,})/g;

export interface MaskRegistry {
  /** 编号 → 原文 */
  byId: Map<string, string>;
  /** 原文 → 编号 */
  byToken: Map<string, string>;
  /** 编号 → 给模型看的类型标记（不含原文） */
  labelById: Map<string, string>;
}

export interface MaskStats {
  totalTokens: number;
  rules: Record<string, number>;
  terms: number;
}

/**
 * 解析设置页的自定义词条：每行 `词条` 或 `词条 | 含义标记`。
 * `|` / `｜` 只作为分隔符；没有标记时返回空 label，由内置规则或默认值补全。
 */
export function parseSensitiveTermLines(lines: string[]): SensitiveTermEntry[] {
  const map = new Map<string, string>();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const sep = line.search(/[|｜]/);
    const value = (sep >= 0 ? line.slice(0, sep) : line).trim();
    const label = sep >= 0 ? line.slice(sep + 1).trim() : '';
    if (!value) continue;
    map.set(value, label || map.get(value) || '');
  }
  return [...map.entries()].map(([value, label]) => ({ value, label }));
}

/** 根据内置规则推断类型标记；不在内置规则内返回空字符串 */
export function inferSensitiveLabel(token: string): string {
  for (const rule of BUILTIN_RULES) {
    try {
      if (new RegExp(`^(?:${rule.source})$`).test(token)) return rule.shortLabel;
    } catch {
      // ignore invalid custom rule
    }
  }
  return '';
}

/** 从文本中提取命中的敏感 token（词库精确匹配 + 规则正则），返回去重集合 */
export function collectSensitiveTokens(texts: string[], terms: string[], rules: SanitizeRuleDef[]): Set<string> {
  const found = new Set<string>();
  for (const text of texts) {
    // 用户词库：精确匹配（按长度降序，长词优先，避免子串误伤——先收集后排序）
    for (const term of terms) {
      if (!term.trim()) continue;
      if (text.includes(term)) found.add(term);
    }
    // 内置/自定义正则规则
    for (const rule of rules) {
      let re: RegExp;
      try {
        re = new RegExp(rule.source, 'g');
      } catch {
        continue;
      }
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        found.add(m[0]);
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    }
  }
  return found;
}

/**
 * 构建全局映射表：所有命中 token 按长度降序去重编号（SENS-001 起），
 * 保证「同一 token 全局同编号」——多文档引用同步改写。
 * labelOf 只提供类型标记，不接触原文；缺省时自动识别内置类型。
 */
export function buildMaskRegistry(
  tokens: Set<string>,
  labelOf?: (token: string) => string,
): MaskRegistry {
  const sorted = [...tokens].sort((a, b) => b.length - a.length);
  const byId = new Map<string, string>();
  const byToken = new Map<string, string>();
  const labelById = new Map<string, string>();
  sorted.forEach((token, i) => {
    const id = `SENS-${String(i + 1).padStart(3, '0')}`;
    byId.set(id, token);
    byToken.set(token, id);
    labelById.set(id, labelOf?.(token) || inferSensitiveLabel(token) || '自定义敏感词');
  });
  return { byId, byToken, labelById };
}

/** 对文本执行脱敏：长 token 先替换（防子串误伤） */
export function maskText(text: string, registry: MaskRegistry): string {
  let out = text;
  const tokens = [...registry.byToken.keys()].sort((a, b) => b.length - a.length);
  for (const token of tokens) {
    const id = registry.byToken.get(token)!;
    // 逐段替换（避免 replaceAll 中 token 相互重叠）
    out = out.split(token).join(MASK_PREFIX + id + MASK_SUFFIX);
  }
  return out;
}

/** 对文本执行还原：兼容 {{SENS-001}} 与裸 SENS-001，未知编号原样保留 */
export function unmaskText(text: string, registry: MaskRegistry): string {
  return text.replace(UNMASK_RE, (_all, a, b) => {
    const id = 'SENS-' + (a ?? b);
    const original = registry.byId.get(id);
    return original ?? _all;
  });
}

/** 统计脱敏覆盖情况（供 UI 展示） */
export function maskStats(registry: MaskRegistry, rulesCount: number, termsCount: number): MaskStats {
  return {
    totalTokens: registry.byId.size,
    rules: {},
    terms: termsCount,
  };
}

/** 提取文本中的编号集合（供「AI 新增了编号引用」检测） */
export function extractMaskIds(text: string): string[] {
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  const re = /\{\{SENS-(\d{3,})\}\}|SENS-(\d{3,})/g;
  while ((m = re.exec(text)) !== null) {
    ids.push('SENS-' + (m[1] ?? m[2]));
  }
  return ids;
}

/**
 * 生成「脱敏编码本」：只列出本次 payload 实际用到的编号 + 类型标记，
 * 不包含任何原文。放在 system prompt 末尾，让模型知道编号代表哪类实体。
 */
export function buildMaskLegend(registry: MaskRegistry, texts: string[]): string | null {
  const used = new Set<string>();
  for (const text of texts) {
    for (const id of extractMaskIds(text)) used.add(id);
  }
  if (used.size === 0) return null;
  const ids = [...used].sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
  const mapping = ids.map(id =>
    `- {{${id}}} — 含义 / type: ${registry.labelById.get(id) || '自定义敏感词'}`
  );
  return [
    '## 脱敏编码本 / Redaction codebook',
    '下面出现的编号是本地脱敏占位符，只代表实体类型，不包含真实值。',
    '请保留编号原样（包含 {{ }}），不要猜测、补全或改写真实内容；引用时使用编号本身，不要用含义标签代替编号。不要复述本编码本。',
    'The codes below are local pseudonyms. Keep each code exactly as written (including braces); never guess or reconstruct the real value. When referring to the entity, use the code itself, not the type label. Do not repeat this codebook.',
    ...mapping,
  ].join('\n');
}
