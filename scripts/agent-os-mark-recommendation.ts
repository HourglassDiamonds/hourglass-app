/**
 * Mark an Agent OS recommendation terminal (completed / dismissed / superseded).
 * Internal/ops only — never sends email, never mutates customer systems.
 *
 * Persistence adapters (IMPORTANT — do not confuse):
 *
 *   --persist-file   (default)
 *     Writes ONLY to local file-local state under tmp/agent-os/state/ (gitignored).
 *     Does NOT update production Supabase. Safe for local dry-runs.
 *
 *   --persist-supabase
 *     Writes to the same remote-durable Supabase adapter used by production
 *     scheduled cadence when SUPABASE env is configured in this process.
 *     Requires live Supabase credentials already present in the environment.
 *     Never prints credentials. Prefer --dry-run first.
 *
 *   --memory
 *     Ephemeral in-process only (tests).
 *
 * Usage:
 *   npx tsx scripts/agent-os-mark-recommendation.ts \
 *     --id=operating-backlog:sprint-concierge-cta-path \
 *     --status=completed \
 *     --source=founder-confirmed \
 *     --persist-file \
 *     [--note="..."] \
 *     [--evidence=6d225b5]
 *
 * Production mechanism (preferred over local CLI):
 *   1. Static CURRENT_OPERATING_BACKLOG marks items completed/cancelled/replaced
 *   2. First scheduled Chief of Staff run bootstraps insert-if-absent into Supabase
 *      BEFORE eligibility/ranking/email (lib/agent-os/run.ts)
 *   3. Or call this CLI with --persist-supabase when ops need an explicit founder mark
 *
 * Use --dry-run to print the mutation without saving.
 */

import {
  defaultAgentOsStatePath,
  FileLocalPersistenceAdapter,
  InMemoryPersistenceAdapter,
  markRecommendationTerminal,
  tryCreateSupabasePersistenceAdapter,
  type TerminalCompletionSource,
  type TerminalRecommendationStatus,
} from "../lib/agent-os/persistence";
import { loadEnvLocalForPreview } from "../lib/agent-os/preview-cli";

function argValue(args: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const hit = args.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

async function main() {
  const args = process.argv.slice(2);
  loadEnvLocalForPreview();

  const id = argValue(args, "id");
  const statusRaw = argValue(args, "status") ?? "completed";
  const sourceRaw = argValue(args, "source") ?? "founder-confirmed";
  const note = argValue(args, "note");
  const evidence = argValue(args, "evidence");
  const supersededBy = argValue(args, "superseded-by");
  const dryRun = args.includes("--dry-run");
  const persistSupabase = args.includes("--persist-supabase");
  const persistMemory = args.includes("--memory");
  const persistFile =
    args.includes("--persist-file") || (!persistSupabase && !persistMemory);

  if (!id) {
    console.error(
      "[agent-os] Required: --id=operating-backlog:<item-id> (canonical recommendation identity)",
    );
    process.exitCode = 2;
    return;
  }

  if (persistSupabase && persistMemory) {
    console.error("[agent-os] Pass only one of --persist-supabase / --memory");
    process.exitCode = 2;
    return;
  }

  const status = statusRaw as TerminalRecommendationStatus;
  if (!["completed", "dismissed", "superseded"].includes(status)) {
    console.error("[agent-os] --status must be completed|dismissed|superseded");
    process.exitCode = 2;
    return;
  }

  const source = sourceRaw as TerminalCompletionSource;
  if (
    !["founder-confirmed", "deployment-verified", "system-reconciled", "test"].includes(
      source,
    )
  ) {
    console.error(
      "[agent-os] --source must be founder-confirmed|deployment-verified|system-reconciled|test",
    );
    process.exitCode = 2;
    return;
  }

  if (status === "superseded" && !supersededBy) {
    console.error("[agent-os] --superseded-by is required when --status=superseded");
    process.exitCode = 2;
    return;
  }

  let store;
  let adapterNote: string;
  if (persistSupabase) {
    const supabase = tryCreateSupabasePersistenceAdapter({ modeScope: "live" });
    if (!supabase) {
      console.error(
        "[agent-os] --persist-supabase requires configured Supabase admin env in this process. " +
          "Local --persist-file does NOT write production. Refusing.",
      );
      process.exitCode = 2;
      return;
    }
    store = supabase;
    adapterNote =
      "remote-durable-supabase (production-equivalent adapter; mutates remote Agent OS state)";
  } else if (persistMemory) {
    store = new InMemoryPersistenceAdapter({ modeScope: "test" });
    adapterNote = "ephemeral-memory (not durable; tests only)";
  } else {
    store = new FileLocalPersistenceAdapter({
      filePath: defaultAgentOsStatePath(),
    });
    adapterNote =
      "file-local only (tmp/agent-os/state/) — does NOT update production Supabase";
  }

  void persistFile;

  if (dryRun) {
    const prior = await store.load();
    const { applyRecommendationTerminalState } = await import(
      "../lib/agent-os/persistence/mark-terminal"
    );
    const { result } = applyRecommendationTerminalState(prior, {
      recommendationId: id,
      status,
      source,
      note,
      evidenceReference: evidence,
      supersededBy,
    });
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          result,
          saved: false,
          adapter: store.adapterId,
          adapterNote,
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await markRecommendationTerminal(store, {
    recommendationId: id,
    status,
    source,
    note,
    evidenceReference: evidence,
    supersededBy,
  });

  console.log(
    JSON.stringify(
      {
        dryRun: false,
        saved: true,
        adapter: store.adapterId,
        adapterNote,
        result,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("[agent-os] mark-recommendation failed:", err);
  process.exitCode = 1;
});
