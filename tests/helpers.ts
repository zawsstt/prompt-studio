// Minimal zero-dependency test harness (QA regression, no project deps added).

export type TestFn = () => void | Promise<void>;

interface SuiteEntry {
  suite: string;
  tests: { name: string; fn: TestFn }[];
}

const registry: SuiteEntry[] = [];
let current: SuiteEntry | null = null;

export function suite(name: string): void {
  current = { suite: name, tests: [] };
  registry.push(current);
}

export function test(name: string, fn: TestFn): void {
  if (!current) throw new Error('test() called outside suite()');
  current.tests.push({ name, fn });
}

export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

export function assertEqual<T>(actual: T, expected: T, msg: string): void {
  if (actual !== expected) {
    throw new Error(`${msg}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  }
}

export function assertIncludes(haystack: string, needle: string, msg: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`${msg}\n  expected to contain: ${JSON.stringify(needle)}\n  actual: ${JSON.stringify(haystack)}`);
  }
}

export async function runAll(): Promise<void> {
  let passed = 0;
  let failed = 0;
  const failures: { suite: string; name: string; error: string }[] = [];

  for (const s of registry) {
    console.log(`\n## ${s.suite}`);
    for (const t of s.tests) {
      try {
        await t.fn();
        passed++;
        console.log(`  PASS ${t.name}`);
      } catch (err) {
        failed++;
        const error = err instanceof Error ? err.message : String(err);
        failures.push({ suite: s.suite, name: t.name, error });
        console.log(`  FAIL ${t.name}\n       ${error.split('\n').join('\n       ')}`);
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`TOTAL: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
  if (failures.length > 0) {
    console.log(`FAILURES:`);
    for (const f of failures) console.log(`  - [${f.suite}] ${f.name}`);
  }
  process.exitCode = failed > 0 ? 1 : 0;
}
