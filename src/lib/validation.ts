import { yamlLanguage } from '@codemirror/lang-yaml';
import type { RuleSet, ValidationIssue } from '../types';

// Parse frontmatter (YAML between --- lines)
export function parseFrontmatter(content: string): { fields: Record<string, string>; raw: string; body: string; endLine: number } {
  const lines = content.split('\n');
  if (lines.length === 0 || lines[0].trim() !== '---') {
    return { fields: {}, raw: '', body: content, endLine: 0 };
  }

  const fields: Record<string, string> = {};
  let endLine = 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endLine = i + 1;
      break;
    }
    const match = lines[i].match(/^(\w+):\s*(.*)$/);
    if (match) {
      fields[match[1]] = match[2];
    }
  }

  const raw = lines.slice(0, endLine).join('\n');
  const body = lines.slice(endLine).join('\n');
  return { fields, raw, body, endLine };
}

// Find module (## heading) line numbers
export function findModules(content: string): { name: string; startLine: number; endLine: number }[] {
  const lines = content.split('\n');
  const modules: { name: string; startLine: number; endLine: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^##\s+(.+)$/);
    if (match) {
      const name = match[1].trim();
      modules.push({ name, startLine: i + 1, endLine: lines.length });
      if (modules.length > 1) {
        modules[modules.length - 2].endLine = i;
      }
    }
  }

  return modules;
}

export function validate(content: string, ruleset: RuleSet): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = content.split('\n');
  const { fields, raw, endLine } = parseFrontmatter(content);
  const modules = findModules(content);

  // Structure rules
  for (const rule of ruleset.structureRules) {
    if (rule.type === 'require-frontmatter') {
      for (const field of rule.fields || []) {
        if (!fields[field]) {
          issues.push({
            line: 1,
            column: 1,
            message: `缺少 frontmatter 字段: ${field}`,
            severity: rule.level,
            ruleType: 'structure',
          });
        }
      }
    } else if (rule.type === 'require-module') {
      const found = modules.some(m => m.name.toLowerCase().includes(rule.module!.toLowerCase()));
      if (!found) {
        issues.push({
          line: endLine + 1,
          column: 1,
          message: rule.error,
          severity: rule.level,
          ruleType: 'structure',
        });
      }
    } else if (rule.type === 'forbid-module') {
      const found = modules.find(m => m.name.toLowerCase().includes(rule.module!.toLowerCase()));
      if (found) {
        issues.push({
          line: found.startLine,
          column: 1,
          message: rule.error,
          severity: rule.level,
          ruleType: 'structure',
        });
      }
    } else if (rule.type === 'forbid-field') {
      // Forbidden frontmatter fields: report at the field's own line in raw
      const rawLines = raw.split('\n');
      for (const field of rule.fields || []) {
        if (fields[field] !== undefined) {
          const idx = rawLines.findIndex(l => new RegExp(`^${field}\\s*:`).test(l));
          issues.push({
            line: idx >= 0 ? idx + 1 : 1,
            column: 1,
            message: rule.error || `禁止 frontmatter 字段: ${field}`,
            severity: rule.level,
            ruleType: 'structure',
          });
        }
      }
    }
    // Note: 'unknown-module' rules are evaluated once below (not per-rule).
  }

  // Unknown-module warnings: modules not covered by any orderRule
  const unknownRule = ruleset.structureRules.find(r => r.type === 'unknown-module');
  if (ruleset.orderRules.length > 0 && !ruleset.allowUnknownModules) {
    const level = unknownRule?.level || 'warning';
    for (const m of modules) {
      const known = ruleset.orderRules.some(r =>
        r.module.toLowerCase() === m.name.toLowerCase() ||
        m.name.toLowerCase().includes(r.module.toLowerCase())
      );
      if (!known) {
        issues.push({
          line: m.startLine,
          column: 1,
          message: `未知模块: ${m.name}，将排序至末尾`,
          severity: level,
          ruleType: 'structure',
        });
      }
    }
  }

  // Format rules
  for (const rule of ruleset.formatRules) {
    if (rule.type === 'codeblock-language') {
      // Find code blocks without language
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^```(\s*)$/);
        if (match) {
          issues.push({
            line: i + 1,
            column: 1,
            message: '代码块应带语言标签',
            severity: rule.warning ? 'warning' : 'error',
            ruleType: 'format',
          });
        }
      }
    } else if (rule.type === 'heading-depth') {
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^(#{4,})\s+/);
        if (match) {
          issues.push({
            line: i + 1,
            column: 1,
            message: `Markdown 标题层级不超过 ${rule.max} 级`,
            severity: 'warning',
            ruleType: 'format',
          });
        }
      }
    } else if (rule.type === 'line-width') {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > (rule.max || 120)) {
          issues.push({
            line: i + 1,
            column: rule.max || 120,
            message: `行宽超过 ${rule.max} 字符`,
            severity: rule.warning ? 'warning' : 'error',
            ruleType: 'format',
          });
        }
      }
    } else if (rule.type === 'yaml-frontmatter') {
      // Parse frontmatter YAML with the Lezer YAML parser; report error nodes.
      // The parser is fault-tolerant, so issues only surface for real syntax errors.
      if (raw && endLine > 0) {
        const tree = yamlLanguage.parser.parse(raw);
        const cursor = tree.cursor();
        const reportedLines = new Set<number>();
        do {
          if (cursor.type.isError) {
            const line = raw.slice(0, cursor.from).split('\n').length;
            if (!reportedLines.has(line)) {
              reportedLines.add(line);
              issues.push({
                line,
                column: 1,
                message: 'frontmatter YAML 语法错误',
                severity: 'error',
                ruleType: 'format',
              });
            }
          }
        } while (cursor.next());
      }
    }
  }

  // Style rules
  for (const rule of ruleset.styleRules) {
    if (rule.type === 'forbid-words') {
      for (let i = 0; i < lines.length; i++) {
        for (const word of rule.words || []) {
          if (lines[i].includes(word)) {
            issues.push({
              line: i + 1,
              column: lines[i].indexOf(word) + 1,
              message: `禁止使用模糊词: "${word}"`,
              severity: rule.level || 'warning',
              ruleType: 'style',
            });
          }
        }
      }
    } else if (rule.type === 'person-consistency') {
      // Check for inconsistent person usage
      for (let i = 0; i < lines.length; i++) {
        if (/你\s*应该|你\s*可以/.test(lines[i]) && !/你\s*(必须|需要|要)/.test(lines[i])) {
          issues.push({
            line: i + 1,
            column: 1,
            message: '指令建议用祈使句，减少"你应该/你可以"',
            severity: rule.level || 'info',
            ruleType: 'style',
          });
        }
      }
    } else if (rule.type === 'imperative-verbs') {
      // Heuristic: inside Instructions-like modules, list items / sentence
      // openings phrased as "你应该/你可以/You should/..." weaken imperatives.
      const instructionModules = modules.filter(m => /instruction|指令/i.test(m.name));
      const pattern = /^\s*(?:[-*+]|\d+\.)?\s*(你应该|你可以|你需要|You should|You can|You may)\b/i;
      for (const m of instructionModules) {
        const last = Math.min(m.endLine, lines.length);
        for (let ln = m.startLine; ln <= last; ln++) {
          if (pattern.test(lines[ln - 1])) {
            issues.push({
              line: ln,
              column: 1,
              message: '建议使用祈使句（省略"你应该/你可以"等弱化措辞）',
              severity: 'info',
              ruleType: 'style',
            });
          }
        }
      }
    }
  }

  // Check module order
  if (ruleset.orderRules.length > 0) {
    const expectedOrder = ruleset.orderRules
      .filter(r => !r.optional)
      .sort((a, b) => a.position - b.position)
      .map(r => r.module);

    const actualOrder = modules.map(m => {
      const matched = ruleset.orderRules.find(r =>
        r.module.toLowerCase() === m.name.toLowerCase() ||
        m.name.toLowerCase().includes(r.module.toLowerCase())
      );
      return matched?.module || m.name;
    });

    for (let i = 0; i < expectedOrder.length - 1; i++) {
      const idx1 = actualOrder.indexOf(expectedOrder[i]);
      const idx2 = actualOrder.indexOf(expectedOrder[i + 1]);
      if (idx1 !== -1 && idx2 !== -1 && idx1 > idx2) {
        issues.push({
          line: modules[idx2]?.startLine || 1,
          column: 1,
          message: `模块顺序应为: ${expectedOrder[i]} → ${expectedOrder[i + 1]}`,
          severity: 'warning',
          ruleType: 'order',
        });
        break;
      }
    }
  }

  return issues;
}

// Auto-organize: reorder modules according to ruleset
export function autoOrganize(content: string, ruleset: RuleSet): string {
  const { raw, body } = parseFrontmatter(content);
  const modules = findModules(content);
  const lines = body.split('\n');

  // Find module positions in body
  const bodyModules: { name: string; content: string; orderPos: number }[] = [];
  let currentModule: { name: string; content: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^##\s+(.+)$/);
    if (match) {
      if (currentModule) {
        bodyModules.push({
          name: currentModule.name,
          content: currentModule.content.join('\n'),
          orderPos: getModuleOrder(currentModule.name, ruleset),
        });
      }
      currentModule = { name: match[1].trim(), content: [lines[i]] };
    } else if (currentModule) {
      currentModule.content.push(lines[i]);
    } else {
      // Content before first heading - keep as is
    }
  }
  if (currentModule) {
    bodyModules.push({
      name: currentModule.name,
      content: currentModule.content.join('\n'),
      orderPos: getModuleOrder(currentModule.name, ruleset),
    });
  }

  // Sort by order position, unknown modules go last
  bodyModules.sort((a, b) => {
    if (a.orderPos === -1 && b.orderPos === -1) return 0;
    if (a.orderPos === -1) return 1;
    if (b.orderPos === -1) return -1;
    return a.orderPos - b.orderPos;
  });

  const newBody = bodyModules.map(m => m.content).join('\n\n');
  return raw ? `${raw}\n\n${newBody}` : newBody;
}

function getModuleOrder(moduleName: string, ruleset: RuleSet): number {
  const rule = ruleset.orderRules.find(r =>
    r.module.toLowerCase() === moduleName.toLowerCase() ||
    moduleName.toLowerCase().includes(r.module.toLowerCase())
  );
  return rule?.position ?? -1;
}

/**
 * 按指定的模块名顺序重排文档模块（自动整理确认弹窗中的拖拽自定义排序）。
 * - 出现在 `names` 中的模块按该顺序排列；
 * - 未出现在 `names` 中的模块保持原相对顺序，排在最后（与 autoOrganize 一致）。
 */
export function reorderModules(content: string, names: string[]): string {
  const { raw, body } = parseFrontmatter(content);
  const lines = body.split('\n');

  const bodyModules: { name: string; content: string }[] = [];
  let currentModule: { name: string; content: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^##\s+(.+)$/);
    if (match) {
      if (currentModule) {
        bodyModules.push({ name: currentModule.name, content: currentModule.content.join('\n') });
      }
      currentModule = { name: match[1].trim(), content: [lines[i]] };
    } else if (currentModule) {
      currentModule.content.push(lines[i]);
    }
  }
  if (currentModule) {
    bodyModules.push({ name: currentModule.name, content: currentModule.content.join('\n') });
  }

  const orderMap = new Map(names.map((n, i) => [n, i]));
  const known = bodyModules
    .filter(m => orderMap.has(m.name))
    .sort((a, b) => orderMap.get(a.name)! - orderMap.get(b.name)!);
  const unknown = bodyModules.filter(m => !orderMap.has(m.name));

  const newBody = [...known, ...unknown].map(m => m.content).join('\n\n');
  return raw ? `${raw}\n\n${newBody}` : newBody;
}
