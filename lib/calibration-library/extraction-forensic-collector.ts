/**
 * Temporary extraction forensic snapshots — developer diagnostics only.
 * Parsers push structured OCR/assignment traces here; the validation harness drains them.
 */

export type ForensicSnapshot = {
  source: string;
  phase: string;
  at: string;
  payload: Record<string, unknown>;
};

let enabled = false;
const snapshots: ForensicSnapshot[] = [];

export function setForensicCollectionEnabled(on: boolean): void {
  enabled = on;
  if (!on) snapshots.length = 0;
}

export function isForensicCollectionEnabled(): boolean {
  return enabled;
}

export function pushForensicSnapshot(
  source: string,
  phase: string,
  payload: Record<string, unknown>,
): void {
  if (!enabled) return;
  snapshots.push({
    source,
    phase,
    at: new Date().toISOString(),
    payload,
  });
}

export function drainForensicSnapshots(): ForensicSnapshot[] {
  const out = [...snapshots];
  snapshots.length = 0;
  return out;
}

export function clearForensicSnapshots(): void {
  snapshots.length = 0;
}
