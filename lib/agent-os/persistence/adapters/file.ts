/**
 * File-backed local Agent OS persistence.
 *
 * LOCAL / SINGLE-HOST / MANUAL ONLY.
 * - NOT production-safe on Vercel serverless (ephemeral filesystem).
 * - NOT safe for distributed schedulers or multi-instance writers.
 * - No distributed locking — concurrent runs can race; do not run in parallel
 *   against the same state file.
 * - Writes under tmp/agent-os/state/ (gitignored) by default.
 *
 * Replacement durability:
 * Crash-resistant same-directory replacement with last-known-good recovery.
 * True atomic rename-over-existing is NOT guaranteed on Windows; this adapter
 * never streams/copies new bytes directly onto the only canonical file.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  AgentOsPersistenceError,
  type AgentOsPersistedState,
} from "../types";
import {
  createEmptyPersistedState,
  type AgentOsPersistenceStore,
} from "../store";
import { parsePersistedStateJson, serializePersistedState } from "../migrate";

/** Last-known-good backup sibling of the canonical state file. */
export const FILE_LOCAL_LKG_SUFFIX = ".lkg.bak";

export type FileLocalSaveTestHooks = {
  /** Invoked after temp is written and validated, before any canonical move. */
  afterTempValidated?: () => void;
  /** Invoked after canonical was preserved as LKG (if it existed), before temp→canonical. */
  beforeCanonicalReplace?: () => void;
  /** Invoked after temp has become canonical, before post-replace verification. */
  afterCanonicalReplaceBeforeVerify?: () => void;
};

export type FileLocalAdapterOptions = {
  /** Absolute or cwd-relative path to state file. */
  filePath?: string;
  modeScope?: AgentOsPersistedState["modeScope"];
  /**
   * Test-only hooks for simulated mid-save failures.
   * Must not be used in production callers.
   */
  testHooks?: FileLocalSaveTestHooks;
};

export function defaultAgentOsStatePath(cwd = process.cwd()): string {
  return join(cwd, "tmp", "agent-os", "state", "persisted-state.json");
}

export function fileLocalBackupPath(canonicalPath: string): string {
  return `${canonicalPath}${FILE_LOCAL_LKG_SUFFIX}`;
}

function isTempSibling(canonicalBase: string, name: string): boolean {
  return (
    name.startsWith(`${canonicalBase}.`) &&
    name.endsWith(".tmp") &&
    !name.endsWith(FILE_LOCAL_LKG_SUFFIX)
  );
}

export class FileLocalPersistenceAdapter implements AgentOsPersistenceStore {
  readonly adapterId = "file-local" as const;
  readonly durability = "local-durable" as const;
  readonly isDurable = true;
  /**
   * Replacement model: crash-resistant with last-known-good recovery.
   * Not a guarantee of single-syscall atomic rename-over on all platforms.
   */
  readonly replacementModel =
    "crash-resistant-replacement-with-last-known-good-recovery" as const;
  /** Live local/manual runs may opt in; not serverless/distributed-safe. */
  readonly liveEligible = true;
  readonly fixtureEligible = true;

  private readonly filePath: string;
  private readonly modeScope: AgentOsPersistedState["modeScope"];
  private readonly testHooks: FileLocalSaveTestHooks | undefined;

  constructor(options: FileLocalAdapterOptions = {}) {
    this.filePath = options.filePath ?? defaultAgentOsStatePath();
    this.modeScope = options.modeScope ?? "live";
    this.testHooks = options.testHooks;
  }

  async load(): Promise<AgentOsPersistedState> {
    // Never treat *.tmp as canonical.
    this.cleanupOrphanTempFiles({ preserveBackup: true });

    if (!existsSync(this.filePath)) {
      const recovered = this.tryRecoverFromBackup(
        "Canonical state missing; attempting last-known-good recovery",
      );
      if (recovered) return recovered;
      return createEmptyPersistedState({
        adapterId: "file-local",
        durability: "local-durable",
        modeScope: this.modeScope,
      });
    }

    try {
      const raw = readFileSync(this.filePath, "utf8");
      return parsePersistedStateJson(raw);
    } catch (err) {
      if (err instanceof AgentOsPersistenceError) {
        const recovered = this.tryRecoverFromBackup(
          `Canonical state invalid (${err.code}); attempting last-known-good recovery`,
        );
        if (recovered) return recovered;
        throw err;
      }
      const recovered = this.tryRecoverFromBackup(
        "Canonical state unreadable; attempting last-known-good recovery",
      );
      if (recovered) return recovered;
      throw new AgentOsPersistenceError(
        "read-failed",
        "Failed to read Agent OS persisted state file",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  async save(state: AgentOsPersistedState): Promise<void> {
    const dir = dirname(this.filePath);
    const base = basename(this.filePath);
    const tmp = join(dir, `${base}.${process.pid}.${Date.now()}.tmp`);
    const backup = fileLocalBackupPath(this.filePath);
    let canonicalPreservedAsBackup = false;
    let tempPromotedToCanonical = false;

    try {
      mkdirSync(dir, { recursive: true });
      this.cleanupOrphanTempFiles({ preserveBackup: true });

      // 1–2. Write complete state to uniquely named temp and close (writeFileSync).
      const json = serializePersistedState(state);
      writeFileSync(tmp, json, "utf8");

      // 3. Parse/validate temp — corrupt temp must never replace canonical.
      const tmpRaw = readFileSync(tmp, "utf8");
      parsePersistedStateJson(tmpRaw);
      this.testHooks?.afterTempValidated?.();

      // 4. Preserve current canonical as short-lived last-known-good when present.
      //    Never stream/copy new bytes onto the only canonical file.
      if (existsSync(this.filePath)) {
        if (existsSync(backup)) {
          // Stale leftover backup from a prior interrupted save — remove only if
          // current canonical still validates (otherwise keep for recovery).
          try {
            parsePersistedStateJson(readFileSync(this.filePath, "utf8"));
            unlinkSync(backup);
          } catch {
            // Keep existing backup; move current canonical aside with a unique name.
            const alt = `${backup}.${Date.now()}`;
            renameSync(backup, alt);
            try {
              unlinkSync(alt);
            } catch {
              // best-effort
            }
          }
        }
        renameSync(this.filePath, backup);
        canonicalPreservedAsBackup = true;
      }

      this.testHooks?.beforeCanonicalReplace?.();

      // 5. Move validated temp into canonical position (target must not exist).
      renameSync(tmp, this.filePath);
      tempPromotedToCanonical = true;

      this.testHooks?.afterCanonicalReplaceBeforeVerify?.();

      // 6. Read and validate the new canonical file.
      const canonicalRaw = readFileSync(this.filePath, "utf8");
      parsePersistedStateJson(canonicalRaw);

      // 7. Delete backup only after successful verification.
      if (existsSync(backup)) {
        unlinkSync(backup);
      }

      this.cleanupOrphanTempFiles({ preserveBackup: false });
    } catch (err) {
      // Restore last-known-good if replacement/verification failed.
      try {
        if (canonicalPreservedAsBackup && existsSync(backup)) {
          if (tempPromotedToCanonical && existsSync(this.filePath)) {
            try {
              unlinkSync(this.filePath);
            } catch {
              // continue restore attempt
            }
          }
          if (!existsSync(this.filePath)) {
            renameSync(backup, this.filePath);
          }
        }
      } catch (restoreErr) {
        throw new AgentOsPersistenceError(
          "atomic-replace-failed",
          "File-local save failed and last-known-good restore also failed",
          restoreErr instanceof Error ? restoreErr.message : String(restoreErr),
        );
      }

      try {
        if (existsSync(tmp)) unlinkSync(tmp);
      } catch {
        // ignore
      }

      if (err instanceof AgentOsPersistenceError) throw err;
      throw new AgentOsPersistenceError(
        "write-failed",
        "Failed to write Agent OS persisted state file (crash-resistant replacement aborted; prior state preserved when possible)",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  async clear(): Promise<void> {
    if (existsSync(this.filePath)) {
      unlinkSync(this.filePath);
    }
    const backup = fileLocalBackupPath(this.filePath);
    if (existsSync(backup)) {
      unlinkSync(backup);
    }
    this.cleanupOrphanTempFiles({ preserveBackup: false });
  }

  /**
   * If canonical is missing/corrupt and a valid `.lkg.bak` exists, restore it
   * to canonical and return the parsed state.
   */
  private tryRecoverFromBackup(reason: string): AgentOsPersistedState | null {
    const backup = fileLocalBackupPath(this.filePath);
    if (!existsSync(backup)) return null;
    try {
      const raw = readFileSync(backup, "utf8");
      const state = parsePersistedStateJson(raw);
      // Explicit recovery: restore backup into canonical position.
      if (existsSync(this.filePath)) {
        try {
          unlinkSync(this.filePath);
        } catch {
          throw new AgentOsPersistenceError(
            "corrupted-state",
            `${reason}; backup is valid but canonical could not be replaced for recovery`,
            backup,
          );
        }
      }
      renameSync(backup, this.filePath);
      return state;
    } catch (err) {
      if (err instanceof AgentOsPersistenceError) throw err;
      throw new AgentOsPersistenceError(
        "corrupted-state",
        `${reason}; backup present but not recoverable`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  /**
   * Remove leftover `*.tmp` siblings. Never delete a `.lkg.bak` unless
   * `preserveBackup` is false (successful verified save / clear).
   */
  private cleanupOrphanTempFiles(options: { preserveBackup: boolean }): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) return;
    const base = basename(this.filePath);
    try {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (isTempSibling(base, name)) {
          try {
            unlinkSync(full);
          } catch {
            // ignore locked temps
          }
          continue;
        }
        if (
          !options.preserveBackup &&
          name === `${base}${FILE_LOCAL_LKG_SUFFIX}`
        ) {
          // Only remove backup when caller confirmed canonical is good.
          // (Successful save already unlinks backup; this is belt-and-suspenders.)
          try {
            if (existsSync(this.filePath)) {
              parsePersistedStateJson(readFileSync(this.filePath, "utf8"));
              unlinkSync(full);
            }
          } catch {
            // keep backup
          }
        }
      }
    } catch {
      // ignore listing errors
    }
  }
}
