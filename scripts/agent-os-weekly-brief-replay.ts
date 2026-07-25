/**
 * Safe local replay of a persisted weekly founder brief through the new renderer.
 *
 * - Reads Agent OS persisted state (Supabase via env, or a local sanitized JSON)
 * - Does NOT send email, claim deliveries, call Resend, or invoke cron
 * - Writes preview artifacts under tmp-weekly-brief-replay/ (gitignored)
 *
 * Usage:
 *   SMOKE_ENV_FILE=../hourglass-app-agent-os-daily-cron/.vercel/.env.production.local \
 *     npx tsx scripts/agent-os-weekly-brief-replay.ts --window week:2026-W30
 *
 *   npx tsx scripts/agent-os-weekly-brief-replay.ts --from-file tmp-weekly-brief-replay/sanitized-input.json
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderFounderBriefEmail } from "../lib/agent-os/cadence-delivery/render-email";
import {
  cleanFounderFacingAction,
  composeHighestRoiAction,
  formatWeeklyFounderRangeLabel,
  humanizeFounderTitle,
  isInternalLimitationRecommendation,
  selectFounderPriorities,
  synthesizeWeeklyWhatChanged,
  toFounderFacingPriorityAction,
  weeklyRangeFromCadenceWindow,
} from "../lib/agent-os/brief-quality";
import { tryCreateSupabasePersistenceAdapter } from "../lib/agent-os/persistence/adapters/supabase";
import type { AgentOsPersistedState } from "../lib/agent-os/persistence/types";
import type { AgentRun, FounderBrief, Recommendation } from "../lib/agent-os/types";
import { redactSecretsAndPii } from "../lib/agent-os/redaction";

type SanitizedReplayInput = {
  cadenceWindow: string;
  localDate: string;
  briefEvidenceQuality: string;
  runStatus: string;
  reportingPeriod: { start: string; end: string };
  sourceHealthLabels: string[];
  missingOrUnreliableData: string[];
  recommendations: Array<{
    recommendationId: string;
    owningExecutive: string;
    title: string;
    currentAction: string;
    priorityScore: number;
    confidence: number;
    urgency: string;
    founderSurfaced: boolean;
  }>;
  whatChanged?: string;
  whyItMatters?: string;
  source: string;
  notes: string[];
};

function loadEnvFile(filePath: string): void {
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs(argv: string[]) {
  const windowIdx = argv.indexOf("--window");
  const fileIdx = argv.indexOf("--from-file");
  return {
    window:
      windowIdx >= 0 && argv[windowIdx + 1]
        ? argv[windowIdx + 1]!
        : "week:2026-W30",
    fromFile:
      fileIdx >= 0 && argv[fileIdx + 1] ? resolve(argv[fileIdx + 1]!) : null,
  };
}

function gapsFromSourceHealth(
  labels: string[],
  state: AgentOsPersistedState,
  runId: string | null,
): string[] {
  const run = state.runs.find((r) => r.runId === runId);
  const health = run?.sourceHealthSummary ?? [];
  const gaps: string[] = [];
  for (const h of health) {
    const bad =
      h.retrievalState === "failed" ||
      h.retrievalState === "not-configured" ||
      !h.reachable ||
      !h.complete ||
      !h.configured;
    if (bad) {
      gaps.push(`${h.sourceId} ${h.retrievalState}`);
    }
  }
  if (gaps.length === 0 && labels.length) return labels;
  return gaps;
}

function sanitizeStateToReplayInput(
  state: AgentOsPersistedState,
  cadenceWindow: string,
): SanitizedReplayInput {
  const delivery = Object.values(state.deliveries ?? {}).find(
    (d) =>
      d.cadenceId === "cos-weekly-founder-brief" &&
      d.cadenceWindow === cadenceWindow &&
      (d.status === "sent" || d.status === "claimed" || d.status === "sending"),
  );
  const runId = delivery?.runId ?? null;
  const run =
    state.runs.find((r) => r.runId === runId) ??
    [...state.runs].sort(
      (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt),
    )[0];

  const recs = Object.values(state.recommendations ?? {})
    .filter((r) => r.modeOrigin === "live" || r.timesSurfaced > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  // Prefer recommendations surfaced on/near this run
  const surfaced = recs.filter(
    (r) =>
      r.timesSurfaced > 0 ||
      (runId &&
        r.lastSurfacedAt &&
        run?.startedAt &&
        Math.abs(Date.parse(r.lastSurfacedAt) - Date.parse(run.startedAt)) <
          6 * 60 * 60 * 1000),
  );
  const pool = (surfaced.length ? surfaced : recs).slice(0, 12);

  const range = weeklyRangeFromCadenceWindow(cadenceWindow);
  const missing = gapsFromSourceHealth([], state, run?.runId ?? null);

  return {
    cadenceWindow,
    localDate: "2026-07-25",
    briefEvidenceQuality: run?.briefEvidenceQuality ?? "partial-degraded",
    runStatus: run?.agentRunStatus ?? "completed-with-warnings",
    reportingPeriod: range,
    sourceHealthLabels: (run?.sourceHealthSummary ?? []).map(
      (h) => `${h.sourceId ?? "src"}:${h.retrievalState ?? "?"}`,
    ),
    missingOrUnreliableData: missing.map((g) => redactSecretsAndPii(g)),
    recommendations: pool.map((r) => {
      const finding = Object.values(state.findings ?? {}).find(
        (f) => f.findingId === r.recommendationId,
      );
      const rawTitle = finding?.summary?.trim() || r.recommendationId;
      return {
      recommendationId: r.recommendationId.replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        "uuid",
      ),
      owningExecutive: r.owningExecutive,
      title: redactSecretsAndPii(rawTitle),
      currentAction: redactSecretsAndPii(r.currentAction),
      priorityScore: r.priorityScore,
      confidence: r.confidence,
      urgency: String(r.urgency),
      founderSurfaced: Boolean(r.timesSurfaced > 0 || r.firstSurfacedAt),
    };
    }),
    source: "supabase-persisted-state",
    notes: [
      delivery
        ? `Matched delivery status=${delivery.status} window=${delivery.cadenceWindow}`
        : "No matching delivery row; used latest live run/recommendations",
      "Full founder email body is not persisted; brief narrative reconstructed from recommendation titles/actions + source health.",
      "runId/deliveryId omitted from sanitized snapshot.",
    ],
  };
}

function stubRecommendationFromSanitized(
  r: SanitizedReplayInput["recommendations"][number],
): Recommendation {
  const title = humanizeFounderTitle(
    r.title === r.recommendationId ? r.recommendationId : r.title,
  );
  return {
    recommendationId: r.recommendationId,
    originatingExecutive: r.owningExecutive as Recommendation["originatingExecutive"],
    title,
    plainLanguageExplanation: cleanFounderFacingAction(r.currentAction),
    whyItMattersNow: cleanFounderFacingAction(r.currentAction),
    proposedAction: cleanFounderFacingAction(r.currentAction),
    expectedUpside: "Improve qualified inquiry flow from existing content.",
    effortEstimate: "low",
    urgency: (["critical", "high", "medium", "low"].includes(r.urgency)
      ? r.urgency
      : "medium") as Recommendation["urgency"],
    reversibility: "easily-reversed",
    confidence: r.confidence,
    priorityScore: r.priorityScore,
    evidence: [],
    assumptions: [],
    risks: [],
    dependencies: [],
    approvalRequired: false,
    suggestedOwner: "Founder",
    status: "proposed",
    agendaBucket: "do-now",
    rankingFactors: {
      expectedBusinessImpact: 7,
      confidence: r.confidence,
      urgency: r.urgency === "critical" ? 10 : r.urgency === "high" ? 8 : 5,
      effort: 3,
      reversibility: 8,
      strategicAlignment: 7,
      dependencyReadiness: 0.7,
      dataQuality: 0.5,
    },
    blockedReasons: [],
  };
}

function buildRunFromSanitized(input: SanitizedReplayInput): AgentRun {
  const stubs = input.recommendations
    .map(stubRecommendationFromSanitized)
    .filter((r) => !isInternalLimitationRecommendation(r))
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const selected = selectFounderPriorities(stubs, { max: 5 });
  const highest = selected.highest;
  const additional = selected.additional;

  const highestRoiAction = highest
    ? composeHighestRoiAction({
        title: highest.title,
        proposedAction: highest.proposedAction,
        intent: "weekly",
        plainLanguageExplanation: highest.plainLanguageExplanation,
        expectedUpside: highest.expectedUpside,
        whyItMattersNow: highest.whyItMattersNow,
      })
    : "Evidence this week is too thin to support a high-confidence new initiative. Finish the current publishing cadence and let enough performance data accumulate before changing direction.";

  const priorities = additional.map((r) =>
    toFounderFacingPriorityAction(r.title, r.proposedAction),
  );

  const whatChanged =
    input.whatChanged ??
    synthesizeWeeklyWhatChanged({
      recommendationTitles: stubs.map((r) => r.recommendationId),
      missingOrUnreliableData: input.missingOrUnreliableData,
    });

  const whyItMatters =
    input.whyItMatters ??
    (input.missingOrUnreliableData.some((g) => /ga4|gsc|failed/i.test(g))
      ? "This week produced useful content and search opportunities, but incomplete website and search analytics mean the evidence does not yet support a major strategic change."
      : "Keep the operating focus on clear education-to-product handoffs that move interested readers toward consultation.");

  const brief: FounderBrief = {
    whatChanged,
    whyItMatters,
    needsAttentionToday: ["See highest-ROI action below"],
    highestRoiAction,
    canSafelyWait: ["None"],
    blocked: ["None"],
    founderDecisionNeeded: ["No founder approvals required this week."],
    missingOrUnreliableData: input.missingOrUnreliableData,
    markdown: "# replay",
    surfacedPriorityTitles: priorities,
  };

  const evidenceQuality = (
    [
      "full",
      "partial-degraded",
      "none-blocked",
      "failed",
    ] as const
  ).includes(input.briefEvidenceQuality as AgentRun["briefEvidenceQuality"])
    ? (input.briefEvidenceQuality as AgentRun["briefEvidenceQuality"])
    : "partial-degraded";
  // Founder confidence should reflect source health even if run marked "full".
  const effectiveEvidence =
    input.missingOrUnreliableData.some((g) => /ga4|gsc|failed/i.test(g)) &&
    evidenceQuality === "full"
      ? "partial-degraded"
      : evidenceQuality;
  const runStatus = (
    [
      "completed",
      "completed-with-warnings",
      "failed",
      "blocked",
    ] as const
  ).includes(input.runStatus as AgentRun["runStatus"])
    ? (input.runStatus as AgentRun["runStatus"])
    : "completed-with-warnings";

  return {
    runId: "run-local-replay-sanitized",
    generatedAt: "2026-07-25T14:10:00.000Z",
    mode: "live",
    reportingPeriod: input.reportingPeriod,
    executivesInvoked: [
      "chief-of-staff",
      "business-intelligence",
      "search-strategy",
      "content",
      "opportunity",
    ],
    executivesNotOperational: [],
    sourcesAttempted: [],
    sourceHealth: [],
    recommendations: stubs,
    anomalies: [],
    dataGaps: [],
    escalationItems: [],
    brief,
    runStatus,
    recommendationAvailability: highest
      ? "has-material-recommendations"
      : "none-material",
    executiveStatuses: [],
    briefEvidenceQuality: effectiveEvidence,
    deliveryGuidance:
      effectiveEvidence === "partial-degraded"
        ? "send-degraded-partial-brief"
        : "send-normal-brief",
    briefSurfacing: {
      opportunitiesDetected: stubs.length,
      recommendationsRanked: stubs.length,
      recommendationsSurfacedInBrief: Math.min(
        (highest ? 1 : 0) + priorities.length,
        5,
      ),
    },
    durationMs: 0,
    version: "1.0.0",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = join(process.cwd(), "tmp-weekly-brief-replay");
  mkdirSync(outDir, { recursive: true });

  const envPath =
    process.env.SMOKE_ENV_FILE ||
    resolve(process.cwd(), "..", "hourglass-app", ".env.local");
  if (!args.fromFile && existsSync(envPath)) {
    loadEnvFile(envPath);
    console.log(`[replay] loaded env keys from ${envPath} (values not printed)`);
  } else if (!args.fromFile) {
    const fallback = resolve(
      process.cwd(),
      "..",
      "hourglass-app-agent-os-daily-cron",
      ".vercel",
      ".env.production.local",
    );
    if (existsSync(fallback)) {
      loadEnvFile(fallback);
      console.log(
        `[replay] loaded env keys from ${fallback} (values not printed)`,
      );
    }
  }

  let sanitized: SanitizedReplayInput;
  if (args.fromFile) {
    sanitized = JSON.parse(readFileSync(args.fromFile, "utf8")) as SanitizedReplayInput;
    sanitized.source = `file:${args.fromFile}`;
  } else {
    const store = tryCreateSupabasePersistenceAdapter({ modeScope: "live" });
    if (!store) {
      console.error(
        "[replay] No Supabase adapter (missing env) and no --from-file. Cannot load production run.",
      );
      process.exitCode = 2;
      return;
    }
    const state = await store.load();
    sanitized = sanitizeStateToReplayInput(state, args.window);
    const sanitizedPath = join(outDir, "sanitized-input.json");
    writeFileSync(sanitizedPath, JSON.stringify(sanitized, null, 2), "utf8");
    console.log(`[replay] wrote sanitized snapshot → ${sanitizedPath}`);
  }

  const run = buildRunFromSanitized(sanitized);
  const range = weeklyRangeFromCadenceWindow(sanitized.cadenceWindow);
  const rendered = renderFounderBriefEmail({
    run,
    cadenceId: "cos-weekly-founder-brief",
    cadenceWindow: sanitized.cadenceWindow,
    degraded:
      sanitized.briefEvidenceQuality === "partial-degraded" ||
      sanitized.briefEvidenceQuality === "none-blocked",
  });

  writeFileSync(join(outDir, "subject.txt"), rendered.subject, "utf8");
  writeFileSync(join(outDir, "body.txt"), rendered.text, "utf8");
  writeFileSync(join(outDir, "body.html"), rendered.html, "utf8");
  writeFileSync(
    join(outDir, "meta.json"),
    JSON.stringify(
      {
        cadenceWindow: sanitized.cadenceWindow,
        expectedRange: formatWeeklyFounderRangeLabel(range.start, range.end),
        source: sanitized.source,
        notes: sanitized.notes,
        recommendationCount: sanitized.recommendations.length,
        claim: "local-replay-only-no-delivery",
        reconstructionNote:
          "Original founder email body is not persisted in the delivery ledger; narrative fields were synthesized from recommendation actions + source health for local preview only.",
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("=== Weekly brief REPLAY (local, no send) ===");
  console.log(`Source: ${sanitized.source}`);
  for (const n of sanitized.notes) console.log(`[meta] ${n}`);
  console.log(
    "[meta] Original founder email body is not persisted; rendered narrative is synthesized for local preview only.",
  );
  console.log(`Subject: ${rendered.subject}`);
  console.log("");
  console.log(rendered.text);
  console.log("");
  console.log(`Wrote ${join(outDir, "body.html")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
