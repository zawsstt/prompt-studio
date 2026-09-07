// In-memory stub for src/store/db.ts device-keystore functions.
// Bundled in place of the real Dexie-backed module via tests/build.mjs.
// Set QA_DB_MODE=fail to simulate an environment without IndexedDB
// (getDeviceKeyRecord throws, forcing crypto.ts down its fallback path).

let storedKey: { id: string; key: unknown } | null = null;

function shouldFail(): boolean {
  return typeof process !== 'undefined' && process.env.QA_DB_MODE === 'fail';
}

export async function getDeviceKeyRecord(id: string = 'device'): Promise<{ id: string; key: unknown } | undefined> {
  if (shouldFail()) throw new Error('indexedDB is not defined (mocked)');
  return storedKey ?? undefined;
}

export async function saveDeviceKeyRecord(key: unknown, id: string = 'device'): Promise<void> {
  if (shouldFail()) throw new Error('indexedDB is not defined (mocked)');
  storedKey = { id, key };
}
