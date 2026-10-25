// ── Template variables: `{{var}}` extraction & rendering (P0-2, used by evaluation) ──

const VAR_PATTERN = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

/** Unique variable names in order of first appearance. */
export function extractVariables(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(VAR_PATTERN)) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

export interface RenderResult {
  text: string;
  /** Placeholders with no value provided — rendered as the literal `{{name}}` */
  missing: string[];
}

/** Replace `{{var}}` with provided values; unknown placeholders are left intact. */
export function renderTemplate(text: string, vars: Record<string, string>): RenderResult {
  const missing: string[] = [];
  const rendered = text.replace(VAR_PATTERN, (raw, name: string) => {
    const value = vars[name];
    if (value === undefined || value === '') {
      missing.push(name);
      return raw;
    }
    return value;
  });
  return { text: rendered, missing: Array.from(new Set(missing)) };
}

/** Build a `{ var: '' }` map from a template, preserving any existing values. */
export function scaffoldVars(template: string, existing: Record<string, string> = {}): Record<string, string> {
  const next: Record<string, string> = {};
  for (const name of extractVariables(template)) {
    next[name] = existing[name] ?? '';
  }
  return next;
}
