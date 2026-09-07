import type { ScopeModule } from '../types';

/**
 * Parse markdown content into heading-based modules (P1-9).
 * Pure-function version shared by the store (scope creation) and the editor
 * (read-only enforcement re-parses on every transaction to survive line drift).
 */
export function parseModulesFromContent(content: string): ScopeModule[] {
  const lines = content.split('\n');
  const modules: ScopeModule[] = [];
  let currentHeading: string | null = null;
  let currentLevel = 0;
  let currentStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)/);
    if (match) {
      // Close previous module
      if (currentHeading !== null) {
        modules.push({
          heading: currentHeading,
          level: currentLevel,
          startLine: currentStart + 1,
          endLine: i,
          selected: true,
          locked: false,
        });
      }
      currentHeading = match[2].trim();
      currentLevel = match[1].length;
      currentStart = i;
    }
  }
  // Close last module
  if (currentHeading !== null) {
    modules.push({
      heading: currentHeading,
      level: currentLevel,
      startLine: currentStart + 1,
      endLine: lines.length,
      selected: true,
      locked: false,
    });
  }
  return modules;
}
