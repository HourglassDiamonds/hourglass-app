/**
 * Manual Agent OS founder brief runner (Node / server only).
 *
 * Usage:
 *   npm run agent-os:brief -- --cadence=daily
 *   npm run agent-os:brief -- --cadence=weekly
 *   npm run agent-os:brief:live -- --cadence=daily
 *   npm run agent-os:brief:live -- --cadence=weekly
 *
 * Cadence intent (preview defaults to daily — never silently weekly):
 *   --cadence=daily | --cadence=weekly
 *   --daily | --weekly   (aliases)
 *
 * Optional persistence (Agent OS operational state only — no email):
 *   --persist              enable persistence (fixture→memory; live→unconfigured unless other flags)
 *   --persist-file         file-local adapter under tmp/agent-os/state/ (gitignored)
 *   --persist-memory-live  explicit non-durable live memory (labeled)
 *   --require-persistence  fail CLI if persistence write/load fails (live scheduled semantics)
 *   --on-demand            recurrence cooldown bypass for founder brief surfacing
 *
 * Local env (CLI only — never affects Vercel runtime):
 *   Loads `.env.local` from cwd when present.
 *   Precedence: already-set process/shell env wins; `.env.local` fills gaps only.
 *   Never prints env values. Does not pull Production secrets from Vercel.
 *
 * Default commands do NOT silently write durable state or send email.
 * State directory tmp/agent-os/ is gitignored.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runAgentOsBrief } from "../lib/agent-os/run";
import type { BriefCadenceIntent } from "../lib/agent-os/brief-quality";
import {
  loadEnvLocalForPreview,
  parseBriefCadenceIntent,
} from "../lib/agent-os/preview-cli";
import {
  containsLikelyPiiOrSecret,
  redactSecretsAndPii,
} from "../lib/agent-os/redaction";
import { defaultAgentOsStatePath } from "../lib/agent-os/persistence";
import { FOUNDER_CADENCE_TIMEZONE } from "../lib/agent-os/persistence/cadence";
import { localCalendarStamp } from "../lib/agent-os/persistence/timezone";

async function main() {
  const args = process.argv.slice(2);
  const envLoad = loadEnvLocalForPreview();
  if (envLoad.loaded) {
    console.log(
      `[agent-os] loaded .env.local gaps-only (${envLoad.keysApplied} keys applied; shell env preserved)`,
    );
  }

  const live = args.includes("--live");
  if (live && args.includes("--fixture")) {
    console.error("[agent-os] Pass either --live or --fixture, not both");
    process.exitCode = 2;
    return;
  }
  const mode = live ? "live" : "fixture";

  let briefCadenceIntent: BriefCadenceIntent;
  try {
    briefCadenceIntent = parseBriefCadenceIntent(args);
  } catch (err) {
    console.error(`[agent-os] ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
    return;
  }

  const persist = args.includes("--persist") || args.includes("--persist-file");
  const persistFile = args.includes("--persist-file");
  const persistMemoryLive = args.includes("--persist-memory-live");
  const requirePersistence = args.includes("--require-persistence");
  const onDemand = args.includes("--on-demand");

  if (persistMemoryLive && !live) {
    console.error(
      "[agent-os] --persist-memory-live is only valid with --live",
    );
    process.exitCode = 2;
    return;
  }

  const briefLocalDate =
    briefCadenceIntent === "daily"
      ? localCalendarStamp(new Date().toISOString(), FOUNDER_CADENCE_TIMEZONE)
          .date
      : undefined;

  console.log(
    `[agent-os] Starting ${mode} brief run (cadence=${briefCadenceIntent}; persist=${persist}; deliver=never)…`,
  );

  const run = await runAgentOsBrief({
    mode,
    briefCadenceIntent,
    briefLocalDate,
    persistence: persist
      ? {
          enabled: true,
          trigger: onDemand ? "on-demand" : "manual",
          adapter: persistFile
            ? "file-local"
            : persistMemoryLive && live
              ? "memory"
              : mode === "fixture"
                ? "memory"
                : "unconfigured-production",
          filePath: persistFile ? defaultAgentOsStatePath() : undefined,
          allowNonDurableLive: persistMemoryLive,
          requirePersistenceWrite: requirePersistence,
          onDemandRecurrenceBypass: onDemand,
        }
      : undefined,
  });

  if (run.mode !== mode) {
    console.error(
      `[agent-os] Mode mismatch: requested ${mode}, run.mode=${run.mode}`,
    );
    process.exitCode = 2;
    return;
  }

  if (
    mode === "live" &&
    run.sourceHealth.some((h) => h.retrievalState === "fixture")
  ) {
    console.error(
      "[agent-os] Live run contained fixture retrieval state — refusing artifacts",
    );
    process.exitCode = 2;
    return;
  }

  if (requirePersistence && run.persistence && !run.persistence.ok) {
    console.error(
      `[agent-os] Required persistence failed (${run.persistence.errorCode}): ${run.persistence.error}`,
    );
    process.exitCode = 1;
  }

  const outDir = join(process.cwd(), "tmp", "agent-os");
  mkdirSync(outDir, { recursive: true });

  const stamp = run.generatedAt.replace(/[:.]/g, "-");
  const jsonPath = join(
    outDir,
    `brief-${mode}-${briefCadenceIntent}-${stamp}.json`,
  );
  const mdPath = join(
    outDir,
    `brief-${mode}-${briefCadenceIntent}-${stamp}.md`,
  );

  const json = JSON.stringify(run, null, 2);
  const markdown = run.brief.markdown;

  if (containsLikelyPiiOrSecret(json) || containsLikelyPiiOrSecret(markdown)) {
    console.error(
      "[agent-os] Refusing to write artifacts: possible PII or secret detected after redaction pass",
    );
    process.exitCode = 2;
    return;
  }

  writeFileSync(jsonPath, redactSecretsAndPii(json), "utf8");
  writeFileSync(mdPath, redactSecretsAndPii(markdown), "utf8");

  console.log(`[agent-os] mode=${run.mode}`);
  console.log(`[agent-os] cadenceIntent=${briefCadenceIntent}`);
  console.log(`[agent-os] runId=${run.runId}`);
  console.log(
    `[agent-os] status=${run.runStatus} recommendationAvailability=${run.recommendationAvailability} durationMs=${run.durationMs}`,
  );
  console.log(
    `[agent-os] evidence=${run.briefEvidenceQuality} delivery=${run.deliveryGuidance}`,
  );
  console.log(
    `[agent-os] executiveStatuses=${run.executiveStatuses.map((e) => `${e.executiveId}:${e.status}`).join(",")}`,
  );
  console.log(
    `[agent-os] executives invoked=${run.executivesInvoked.join(",")} scaffold=${run.executivesNotOperational.join(",")}`,
  );
  console.log(
    `[agent-os] opportunities=${run.briefSurfacing.opportunitiesDetected} ranked=${run.briefSurfacing.recommendationsRanked} surfacedInBrief=${run.briefSurfacing.recommendationsSurfacedInBrief} (jsonRecs=${run.recommendations.length}) anomalies=${run.anomalies.length} gaps=${run.dataGaps.length}`,
  );
  if (run.persistence) {
    console.log(
      `[agent-os] persistence ok=${run.persistence.ok} adapter=${run.persistence.adapterId} durability=${run.persistence.durabilityLabel}` +
        (run.persistence.error ? ` error=${run.persistence.error}` : ""),
    );
  } else {
    console.log(`[agent-os] persistence=null (non-persisting default)`);
  }
  console.log(`[agent-os] wrote ${jsonPath}`);
  console.log(`[agent-os] wrote ${mdPath}`);
  console.log("\n--- Founder Brief ---\n");
  console.log(markdown);
}

main().catch((err) => {
  console.error("[agent-os] failed:", redactSecretsAndPii(String(err)));
  process.exitCode = 1;
});
