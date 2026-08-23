/**
 * CLI runtime sequence for Client Memory import.
 * Production adapter is loaded only after apply flags and fingerprint succeed.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyReconciliationWorkbook } from "./apply";
import {
  AUDITED_RECONCILIATION_V3,
  fingerprintWorkbook,
} from "./artifact";
import { dryRunReconciliationWorkbook } from "./dry-run";
import {
  envImportEnabled,
  evaluateApplyFlagGates,
  type ApplyTarget,
} from "./gates";
import {
  InMemoryClientMemoryStore,
  type ClientMemoryStore,
} from "./store";

export const AUDITED_WORKBOOK_FINGERPRINT = AUDITED_RECONCILIATION_V3.sha256;

export type ImportRuntimeDeps = {
  loadSupabaseStore: () => Promise<ClientMemoryStore>;
  createMemoryStore?: () => ClientMemoryStore;
  readWorkbook?: (path: string) => Uint8Array;
  workbookExists?: (path: string) => boolean;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

export type ImportRuntimeResult = {
  exitCode: number;
  payload: unknown;
  stderr: boolean;
};

function workbookPathFromArgs(args: string[], cwd: string): string {
  const flagged = args.find((arg) => arg.startsWith("--workbook="));
  if (flagged) return resolve(cwd, flagged.slice("--workbook=".length));
  const idx = args.indexOf("--workbook");
  if (idx >= 0 && args[idx + 1]) return resolve(cwd, args[idx + 1]);
  return resolve(cwd, AUDITED_RECONCILIATION_V3.relativePath);
}

function targetFromArgs(args: string[]): ApplyTarget | null {
  const flagged = args.find((arg) => arg.startsWith("--target="));
  const raw = flagged
    ? flagged.slice("--target=".length)
    : args.includes("--target")
      ? args[args.indexOf("--target") + 1]
      : null;
  if (raw === "memory" || raw === "supabase") return raw;
  return null;
}

export async function runClientMemoryImport(
  args: string[],
  deps: ImportRuntimeDeps,
): Promise<ImportRuntimeResult> {
  const cwd = deps.cwd ?? process.cwd();
  const env = deps.env ?? process.env;
  const workbookExists = deps.workbookExists ?? existsSync;
  const readWorkbook = deps.readWorkbook ?? ((path: string) => readFileSync(path));
  const workbookPath = workbookPathFromArgs(args, cwd);
  const apply = args.includes("--apply");

  if (apply) {
    const target = targetFromArgs(args);
    const confirmProductionClientImport = args.includes(
      "--confirm-production-client-import",
    );
    const envEnabled = envImportEnabled(env);
    const flags = evaluateApplyFlagGates({
      apply: true,
      confirmProductionClientImport,
      envEnabled,
      target,
    });
    if (!flags.ok) {
      return {
        exitCode: 2,
        stderr: true,
        payload: { ok: false, mode: "apply-rejected", reason: flags.reason },
      };
    }

    if (!workbookExists(workbookPath)) {
      return {
        exitCode: 2,
        stderr: true,
        payload: {
          ok: false,
          reason: "workbook-not-found",
          hint: "Pass --workbook=path to Continuum_Reconciliation_v3.xlsx",
        },
      };
    }

    const buffer = readWorkbook(workbookPath);
    const actualHash = fingerprintWorkbook(buffer);
    if (actualHash !== AUDITED_WORKBOOK_FINGERPRINT) {
      return {
        exitCode: 2,
        stderr: true,
        payload: {
          ok: false,
          mode: "apply-rejected",
          reason: "WORKBOOK_FINGERPRINT_MISMATCH",
        },
      };
    }

    let store: ClientMemoryStore;
    if (flags.target === "supabase") {
      store = await deps.loadSupabaseStore();
    } else {
      store = (deps.createMemoryStore ?? (() => new InMemoryClientMemoryStore()))();
    }

    const result = await applyReconciliationWorkbook(buffer, {
      apply: true,
      confirmProductionClientImport,
      envEnabled,
      target: flags.target,
      store,
    });
    if (!result.ok) {
      return { exitCode: 2, stderr: true, payload: result };
    }
    return { exitCode: 0, stderr: false, payload: result };
  }

  if (!workbookExists(workbookPath)) {
    return {
      exitCode: 2,
      stderr: true,
      payload: {
        ok: false,
        reason: "workbook-not-found",
        hint: "Pass --workbook=path to Continuum_Reconciliation_v3.xlsx",
      },
    };
  }

  const buffer = readWorkbook(workbookPath);
  const result = await dryRunReconciliationWorkbook(buffer);
  return { exitCode: 0, stderr: false, payload: result };
}

export async function loadSupabaseClientMemoryStore(): Promise<ClientMemoryStore> {
  const { createSupabaseClientMemoryStore } = await import(
    "./persistence/supabase"
  );
  return createSupabaseClientMemoryStore();
}
