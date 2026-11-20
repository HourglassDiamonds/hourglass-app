import ledger from "@/docs/sterling/local-founder-updates-2026-11-20.json";
import { validateSterlingFounderDirective } from "./founder-directive";
import type { SterlingFounderDirectiveRecord } from "./types";

export const AUTHORIZED_NOVEMBER_20_DIRECTIVE_IDS = [
  "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1",
  "b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2",
] as const;

/** Exact founder-approved batch; rejects drift before any Production write. */
export function authorizedNovember20FounderDirectives(): SterlingFounderDirectiveRecord[] {
  if (ledger.version !== "sterling-local-founder-updates-v1" || !Array.isArray(ledger.updates) ||
      ledger.updates.length !== AUTHORIZED_NOVEMBER_20_DIRECTIVE_IDS.length) {
    throw new Error("authorized-ledger-shape-mismatch");
  }
  const directives = ledger.updates.map((row) => validateSterlingFounderDirective(row));
  if (directives.some((row) => row === null)) throw new Error("authorized-ledger-directive-invalid");
  const typed = directives as SterlingFounderDirectiveRecord[];
  const expected = new Set<string>(AUTHORIZED_NOVEMBER_20_DIRECTIVE_IDS);
  const actual = new Set(typed.map((row) => row.directiveId));
  if (actual.size !== expected.size || [...actual].some((id) => !expected.has(id))) {
    throw new Error("authorized-ledger-target-mismatch");
  }
  return typed;
}
