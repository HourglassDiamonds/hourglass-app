/**
 * Isolated Preview Sol round-trip proof.
 * Does not print secrets. Does not write canonical Continuum state.
 *
 *   npx tsx scripts/continuum-concierge-sol-proof.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OpenAiSolBrain } from "@/lib/continuum/concierge-sol/openai";
import { runConciergeSol } from "@/lib/continuum/concierge-sol/runtime";
import { createTravisSolWorld } from "@/lib/continuum/concierge-sol/travis-world";
import {
  CONCIERGE_FOREGROUND_MODEL,
  CONCIERGE_SOL_RESPONSES_ENDPOINT,
  conciergeForegroundModel,
  isApprovedSolModel,
} from "@/lib/continuum/concierge-sol/models";
import { createSupabaseProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/supabase";
import { composeCurrentProjectCards } from "@/lib/continuum/client-memory/open-projects/card";
import { selectOpenProjectWork } from "@/lib/continuum/client-memory/open-projects/select";
import { groupCurrentProjects } from "@/lib/continuum/client-memory/open-projects/operating-groups";
import type { ConciergeSolWorld } from "@/lib/continuum/concierge-sol/world";
import type { ConciergeSolAnswer, ConciergeSolHistoryTurn } from "@/lib/continuum/concierge-sol/types";

const PREVIEW_REF = "hrmpzplffuhhvbtxxhnt";
const PRODUCTION_REF = "bnafadfgrrriblppeubp";

function parseEnvFile(relativePath: string): Record<string, string> {
  const path = resolve(process.cwd(), relativePath);
  if (!existsSync(path)) return {};
  const map: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }
  return map;
}

function applyMap(map: Record<string, string>): void {
  for (const [key, value] of Object.entries(map)) {
    if (!value.trim()) continue;
    process.env[key] = value;
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

function loadPreviewEnv(): void {
  applyMap(parseEnvFile(".env.local"));
  applyMap(parseEnvFile(".env.development.local"));
  applyMap(parseEnvFile(".env.continuum-preview.local"));
}

function assertPreviewIsolation(): void {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "";
  if (process.env.CONTINUUM_ENV?.trim() !== "preview") {
    fail("[sol-proof] CONTINUUM_ENV must be preview.");
  }
  if (ref === PRODUCTION_REF) {
    fail("[sol-proof] Refusing Production Supabase.");
  }
  if (ref !== PREVIEW_REF) {
    fail("[sol-proof] SUPABASE_URL must be the isolated Preview project.");
  }
  if (process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
    fail("[sol-proof] OPENAI_API_KEY must not use NEXT_PUBLIC_.");
  }
}

function summarize(
  label: string,
  answer: ConciergeSolAnswer,
  extra?: Record<string, unknown>,
) {
  return {
    label,
    apiSuccess: answer.telemetry.brain === "sol",
    brain: answer.telemetry.brain,
    model: answer.telemetry.requestModel,
    approvedModel: isApprovedSolModel(answer.telemetry.requestModel),
    endpoint: CONCIERGE_SOL_RESPONSES_ENDPOINT,
    toolNames: answer.telemetry.toolNames,
    toolCount: answer.telemetry.toolCount,
    inputTokens: answer.telemetry.promptTokens,
    outputTokens: answer.telemetry.completionTokens,
    latencyMs: answer.telemetry.latencyMs,
    writesCanonical: answer.writesCanonical,
    textPreview: answer.text.slice(0, 240),
    ...extra,
  };
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function livePreviewWorld(): Promise<ConciergeSolWorld | null> {
  try {
    const desk = createSupabaseProjectDeskReader();
    const summaries = await desk.listProjects({ limit: 40 });
    const selected = selectOpenProjectWork(summaries);
    const loaded = await Promise.all(
      selected.map(async (item) => {
        const result = await desk.getProjectDesk(item.projectId);
        return result.ok ? result.desk : null;
      }),
    );
    const desks = new Map(
      loaded.filter((row): row is NonNullable<typeof row> => Boolean(row)).map((row) => [row.projectId, row]),
    );
    const cards = composeCurrentProjectCards(summaries, desks);
    const groups = groupCurrentProjects(cards, { nowIso: new Date().toISOString(), viewport: "mobile" });
    const fixture = createTravisSolWorld();
    return {
      ...fixture,
      async listProjects() {
        return summaries;
      },
      async getProjectDesk(projectId) {
        return desk.getProjectDesk(projectId);
      },
      async listCurrentProjectCards() {
        return cards;
      },
      async groupCurrentProjects() {
        return groups;
      },
    };
  } catch {
    return null;
  }
}

async function ask(
  brain: OpenAiSolBrain,
  world: ConciergeSolWorld,
  query: string,
  history: ConciergeSolHistoryTurn[] = [],
): Promise<ConciergeSolAnswer> {
  return runConciergeSol({
    query,
    mode: "conversation",
    history,
    world,
    brain,
  });
}

async function main(): Promise<void> {
  loadPreviewEnv();
  assertPreviewIsolation();

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    fail(
      "[sol-proof] OPENAI_API_KEY is not set in isolated Preview env. Add it to .env.continuum-preview.local (gitignored). Do not paste it into chat. Do not use NEXT_PUBLIC_.",
    );
  }

  const model = conciergeForegroundModel(process.env.CONTINUUM_CONCIERGE_MODEL);
  if (model !== CONCIERGE_FOREGROUND_MODEL) {
    fail(`[sol-proof] Foreground model must resolve to ${CONCIERGE_FOREGROUND_MODEL}.`);
  }

  const preflight = {
    httpStatus: 0,
    errorType: null as string | null,
    errorCode: null as string | null,
    errorParam: null as string | null,
    errorMessage: null as string | null,
    responseModel: null as string | null,
  };

  const fixture = createTravisSolWorld();
  const previewWorld = await livePreviewWorld();
  const rows: ReturnType<typeof summarize>[] = [];

  const repairBrain = new OpenAiSolBrain(apiKey, model);
  const repair = await ask(
    repairBrain,
    fixture,
    "How much does a 14KY sizing on a 2mm shank cost from 6 to 7?",
  );
  rows.push(
    summarize("A-repair", repair, {
      has135: /\$135/.test(repair.text),
      laser: /laser/i.test(repair.text),
      calledRepair: repair.telemetry.toolNames.includes("get_repair_quote"),
      apiFailure: repairBrain.lastApiFailure,
    }),
  );
  preflight.httpStatus = repair.telemetry.brain === "sol" ? 200 : repairBrain.lastApiFailure?.httpStatus ?? 0;
  preflight.errorType = repairBrain.lastApiFailure?.errorType ?? null;
  preflight.errorCode = repairBrain.lastApiFailure?.errorCode ?? null;
  preflight.errorParam = repairBrain.lastApiFailure?.errorParam ?? null;
  preflight.responseModel = repair.telemetry.requestModel;

  await pause(8000);
  const waitingWorld = previewWorld ?? fixture;
  const waitingBrain = new OpenAiSolBrain(apiKey, model);
  const waiting = await ask(waitingBrain, waitingWorld, "Which projects are waiting on me?");
  rows.push(
    summarize("B-waiting", waiting, {
      previewWorld: Boolean(previewWorld),
      calledOperating:
        waiting.telemetry.toolNames.includes("get_open_commitments") ||
        waiting.telemetry.toolNames.includes("get_waiting_state") ||
        waiting.telemetry.toolNames.includes("get_current_projects"),
      apiFailure: waitingBrain.lastApiFailure,
    }),
  );

  await pause(8000);
  const sizeBrain = new OpenAiSolBrain(apiKey, model);
  const size = await ask(sizeBrain, fixture, "What finger size do we have for Travis Morse?");
  rows.push(
    summarize("C-size", size, {
      canonical: /12\.5/.test(size.text),
      proposed: /\b11\b/.test(size.text),
      calledProvenance:
        size.telemetry.toolNames.includes("get_provenance_summary") ||
        size.telemetry.toolNames.includes("get_source_evidence") ||
        size.telemetry.toolNames.includes("get_person_summary"),
      apiFailure: sizeBrain.lastApiFailure,
    }),
  );

  await pause(8000);
  const originBrain = new OpenAiSolBrain(apiKey, model);
  const origin = await ask(originBrain, fixture, "Where did the 11 come from?", [
    { role: "founder", text: "What finger size do we have for Travis Morse?" },
    { role: "concierge", text: size.text },
  ]);
  rows.push(
    summarize("D-origin", origin, {
      unverified: /could not be verified|unknown/i.test(origin.text),
      calledProvenance:
        origin.telemetry.toolNames.includes("get_provenance_summary") ||
        origin.telemetry.toolNames.includes("get_source_evidence"),
      apiFailure: originBrain.lastApiFailure,
    }),
  );

  await pause(8000);
  const goingBrain = new OpenAiSolBrain(apiKey, model);
  const going = await ask(goingBrain, fixture, "What is going on with Travis Morse?");
  await pause(8000);
  const followSizeBrain = new OpenAiSolBrain(apiKey, model);
  const followSize = await ask(followSizeBrain, fixture, "What size do we have?", [
    { role: "founder", text: "What is going on with Travis Morse?" },
    { role: "concierge", text: going.text },
  ]);
  await pause(8000);
  const followOriginBrain = new OpenAiSolBrain(apiKey, model);
  const followOrigin = await ask(followOriginBrain, fixture, "Where did that come from?", [
    { role: "founder", text: "What is going on with Travis Morse?" },
    { role: "concierge", text: going.text },
    { role: "founder", text: "What size do we have?" },
    { role: "concierge", text: followSize.text },
  ]);
  rows.push(summarize("E1-going", going, { apiFailure: goingBrain.lastApiFailure }));
  rows.push(
    summarize("E2-size", followSize, {
      referent: /12\.5/.test(followSize.text),
      apiFailure: followSizeBrain.lastApiFailure,
    }),
  );
  rows.push(
    summarize("E3-origin", followOrigin, {
      referent: /11|could not be verified/i.test(followOrigin.text),
      apiFailure: followOriginBrain.lastApiFailure,
    }),
  );

  const fallbackBrain = new OpenAiSolBrain("sk-invalid-preview-fallback", model);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("no", { status: 503 })) as typeof fetch;
  let fallback: ConciergeSolAnswer;
  try {
    fallback = await ask(
      fallbackBrain,
      fixture,
      "How much does a 14KY sizing on a 2mm shank cost from 6 to 7?",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  rows.push(
    summarize("fallback-unavailable", fallback, {
      fallbackUseful: /\$135/.test(fallback.text),
      claimedSol: fallback.telemetry.brain === "sol",
    }),
  );

  const solRows = rows.filter((row) => row.label !== "fallback-unavailable");
  const allSol = solRows.every((row) => row.apiSuccess && row.approvedModel);
  const proof = {
    endpoint: CONCIERGE_SOL_RESPONSES_ENDPOINT,
    requestedModel: model,
    previewRef: PREVIEW_REF,
    apiPreflight: preflight,
    realSolRoundTrip: allSol,
    fallbackBrain: fallback.telemetry.brain,
    fallbackUseful: /\$135/.test(fallback.text),
    noCanonicalWrites: rows.every((row) => row.writesCanonical === false),
    calls: rows,
  };

  console.info(JSON.stringify(proof, null, 2));
  if (!allSol) process.exit(1);
}

void main();
