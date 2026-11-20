import ledger from "@/docs/sterling/local-founder-updates-2026-11-20.json";
import { isDeepStrictEqual } from "node:util";
import { validateSterlingFounderDirective } from "./founder-directive";
import type { SterlingFounderDirectiveRecord } from "./types";

export const AUTHORIZED_NOVEMBER_20_DIRECTIVE_IDS = [
  "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1",
  "86b13f13-ea1c-45ea-b768-c15f05a49bf8",
] as const;

export const AUTHORIZED_NOVEMBER_20_READBACK_TARGETS = [
  {
    directiveId: "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1",
    noteId: "adc7476b-9092-4b74-b2c1-a04e4c3ff4d4",
    projectId: "6c47edeb-33f8-4aa7-bb38-53bbe023fcc3",
    personId: "9ff1ea75-4d5b-44d0-b2a0-c39ec15b54fd",
  },
  {
    directiveId: "86b13f13-ea1c-45ea-b768-c15f05a49bf8",
    noteId: "1904a048-4233-480e-960c-9320adbd39cd",
    projectId: "affeb07c-745e-4078-8021-27e792309527",
    personId: "3c845863-81c3-4391-9346-1dd18091c0af",
  },
] as const;

export type AuthorizedNovember20Readback = {
  noteId: string;
  directive: SterlingFounderDirectiveRecord;
};

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
  for (const target of AUTHORIZED_NOVEMBER_20_READBACK_TARGETS) {
    const directive = typed.find((row) => row.directiveId === target.directiveId);
    if (!directive || directive.projectId !== target.projectId ||
        directive.personId !== target.personId ||
        directive.workUnitId !== `project:${target.projectId}`) {
      throw new Error("authorized-ledger-identity-mismatch");
    }
  }
  return typed;
}

/** Exact, read-only match against the two founder-approved kept notes. */
export function matchAuthorizedNovember20FounderDirectiveReadback(
  loaded: readonly AuthorizedNovember20Readback[],
): AuthorizedNovember20Readback[] | null {
  const approved = authorizedNovember20FounderDirectives();
  const matched: AuthorizedNovember20Readback[] = [];
  for (const target of AUTHORIZED_NOVEMBER_20_READBACK_TARGETS) {
    const expected = approved.find((row) => row.directiveId === target.directiveId);
    const current = loaded.find((row) => row.noteId === target.noteId);
    if (!expected || !current || current.directive.directiveId !== target.directiveId ||
        current.directive.projectId !== target.projectId ||
        current.directive.personId !== target.personId ||
        current.directive.workUnitId !== `project:${target.projectId}` ||
        !isDeepStrictEqual(current.directive, expected)) {
      return null;
    }
    matched.push(current);
  }
  return matched;
}
