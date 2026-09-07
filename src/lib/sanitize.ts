// ── 敏感数据脱敏引擎（Sensitive Data Sanitizer） ──
// 原则：全程离线本地逻辑，AI 永不接触原文。
// 1. 全局词表：扫描全部文档 → 提取敏感值 → 统一编号（SENS-001…）→ 所有文档同步替换
// 2. 编号占位格式 {{SENS-001}}：不易被 AI 误改，且可正则还原
// 3. 还原容错：AI 可能微调编号格式，unmask 时兼容 {{SENS-001}} / SENS-001 两种形态

export interface SanitizeRuleDef {
  id: string;
  label: string;
  /** 正则源码（无 /g，内部统一加 g） */
  source: string;
}

/** 内置规则：SQL 底表命名 + 个人信息常见模式 */
export const BUILTIN_RULES: SanitizeRuleDef[] = [
  {
    id: 'sql-table',
    label: 'SQL 底表名（ods_/dwd_/dws_/ads_/dim_/tmp_/stg_ 前缀）',
    source: '\\b(?:ods|dwd|dws|ads|dim|tmp|stg)_[a-zA-Z0-9_]{2,}\\b',
  },
  {
    id: 'phone',
    label: '手机号（1 开头 11 位）',
    source: '1[3-9]\\d{9}',
  },
  {
    id: 'idcard',
    label: '身份证号（18 位）',
    source: '\\b\\d{17}[\\dXx]\\b',
  },
  {
    id: 'email',
    label: '邮箱地址',
    source: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
  },
  {
    id: 'ip-internal',
    label: '内网 IP（10./172.16-31./192.168.）',
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
  /** 原文 → 编号（含占位完整形态） */
  byToken: Map<string, string>;
}

export interface MaskStats {
  totalTokens: number;
  rules: Record<string, number>;
  terms: number;
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
 */
export function buildMaskRegistry(tokens: Set<string>): MaskRegistry {
  const sorted = [...tokens].sort((a, b) => b.length - a.length);
  const byId = new Map<string, string>();
  const byToken = new Map<string, string>();
  sorted.forEach((token, i) => {
    const id = `SENS-${String(i + 1).padStart(3, '0')}`;
    byId.set(id, token);
    byToken.set(token, id);
  });
  return { byId, byToken };
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
