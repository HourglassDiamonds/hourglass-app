/** READ-ONLY live Sterling-native Today replay. No canonical or snapshot writes. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";
import { hashEmail } from "../lib/continuum/client-memory/hashes";
import { getContinuumGmailFounderEmail } from "../lib/continuum/gmail/env";
import { CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF } from "../lib/continuum/runtime-env";
import { assembleSterlingTodayShadow, executeSterlingTodaySemantic } from "../lib/continuum/today-sterling/server-runner";
import { NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS } from "../lib/continuum/today-sterling/operational-reconciliation-scope";
import {
  createConnectorEvidenceBatch,
  validateConnectorEvidenceEnvelope,
} from "../lib/continuum/today-sterling/connector-evidence-envelope";
import { buildSanitizedOperationalShadowResult } from "../lib/continuum/today-sterling/operational-shadow-review";
import { compareOperationalBoard } from "../lib/continuum/today-sterling/operational-board-comparison";

function reportStage(stage: string, identifiers: { requestId?: string | null; responseId?: string | null } = {}) {
  process.stderr.write(`STERLING_SHADOW_STAGE ${JSON.stringify({ stage, at: new Date().toISOString(), ...identifiers })}\n`);
}

function loadEnvFile(path: string) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const text = line.trim(); if (!text || text.startsWith("#")) continue;
      const split = text.indexOf("="); if (split < 0) continue;
      const key = text.slice(0, split).trim(); let value = text.slice(split + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
      if (key.endsWith("_SUPABASE_URL") && !process.env.SUPABASE_URL) process.env.SUPABASE_URL = value;
    }
  } catch { /* optional */ }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve("C:/Users/justi/OneDrive/Desktop/hourglass-app/.env.local"));
loadEnvFile(resolve("C:/Users/justi/OneDrive/Desktop/hourglass-app/.env.production.local"));
loadEnvFile(resolve("C:/Users/justi/OneDrive/Desktop/hourglass-app/.env.gmail.production.local"));

function required(name: string): string {
  const value = process.env[name]?.trim() ?? ""; if (!value) throw new Error(`missing-${name}`); return value;
}

async function connectorBatchFromStdin() {
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let payload = "";
  for await (const line of input) payload += `${line}\n`;
  input.close();
  if (!payload) throw new Error("connector-stdin-empty");
  const expectedMailboxHash = hashEmail(getContinuumGmailFounderEmail());
  if (!expectedMailboxHash) throw new Error("connector-mailbox-identity-unavailable");
  const envelope = validateConnectorEvidenceEnvelope({
    value: JSON.parse(payload) as unknown,
    expectedMailboxHash,
    allowedThreadIds: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS,
  });
  reportStage("envelope_validated");
  return createConnectorEvidenceBatch(envelope);
}

async function runSyntheticTransportScenario(scenario: string) {
  if (process.env.NODE_ENV !== "test") throw new Error("synthetic-shadow-scenario-refused");
  await connectorBatchFromStdin();
  if (scenario === "early_rejection") throw new Error("synthetic-early-child-rejection");
  reportStage("assembly_completed");
  reportStage("evidence_gate_evaluated");
  if (scenario === "premature_exit") { process.stderr.write("synthetic-premature-child-exit\n"); process.exitCode = 9; return; }
  reportStage("model_request_dispatched", { requestId: "req_synthetic" });
  if (scenario === "model_timeout") await new Promise(() => undefined);
  reportStage("model_response_received", { requestId: "req_synthetic", responseId: "resp_synthetic" });
  const expected = [{ workUnitId: "synthetic:one", label: "Synthetic one", personId: null, projectId: null,
    jobId: null, exactSourceRefs: ["synthetic:source"], material: true, disposition: "founder_action" as const,
    owner: "founder" as const, lifecycleStage: null, jobsExpectedClosed: [] }];
  const generatedBoard = [{ workUnitId: "synthetic:one", label: "Synthetic one", personId: null,
    projectId: null, jobId: null, exactSourceRefs: ["synthetic:source"], disposition: "founder_action" as const,
    owner: "founder" as const, lifecycleStage: null, openJobIds: [] }];
  const comparator = compareOperationalBoard({ expected, actual: generatedBoard });
  reportStage("validation_comparison_completed");
  process.stdout.write(`${JSON.stringify({ contract: "sterling-operational-shadow-v11-sanitized-result-v1",
    scope: { threadCount: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS.length },
    evidenceLimitations: [], generatedBoard, comparator,
    semantic: { verdict: "PASS", validationAccepted: true, blockedWorkUnitIds: [] },
    syntheticPadding: scenario === "oversized_success" ? "x".repeat(600_000) : undefined })}\n`);
}

async function main() {
  const syntheticScenario = process.env.CONTINUUM_STERLING_TEST_CHILD_SCENARIO?.trim();
  if (syntheticScenario === "broken_stdin" && process.env.NODE_ENV === "test") {
    process.stderr.write("synthetic-broken-stdin\n"); process.exitCode = 10; return;
  }
  if (syntheticScenario) { await runSyntheticTransportScenario(syntheticScenario); return; }
  const withModel = process.argv.includes("--with-model");
  const targetCase = process.argv.find((argument) => argument.startsWith("--target-case="))
    ?.slice("--target-case=".length) ?? null;
  const november11Reconciliation = process.argv.includes("--november-11-operational-reconciliation");
  const connectorStdin = process.argv.includes("--connector-json-stdin");
  if (connectorStdin && !november11Reconciliation) {
    throw new Error("connector-stdin-requires-november-11-operational-reconciliation");
  }
  const url = required("SUPABASE_URL");
  if (!url.includes(CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF)) {
    throw new Error("shadow-refuses-non-production-supabase");
  }
  const client = createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const assembly = await assembleSterlingTodayShadow({
    client,
    targetCase,
    ...(november11Reconciliation ? {
      additionalIndexedThreadIds: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS,
      liveRetrievalThreadAllowlist: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS,
      forcedLiveThreadIds: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS,
      includeUnindexedLiveMessages: true,
    } : {}),
    ...(connectorStdin ? { createGmailBatch: connectorBatchFromStdin } : {}),
  });
  reportStage("assembly_completed");
  if (assembly.targetBlockedReason) {
    process.stdout.write(`${JSON.stringify({
      mode: assembly.workingSet.mutationMode,
      verdict: "TARGET_BLOCKED",
      targetCase,
      reason: assembly.targetBlockedReason,
      scopeCoverage: assembly.scopeCoverage,
      evidenceCompleteness: assembly.completeness,
      performance: assembly.performance,
    }, null, 2)}\n`);
    process.exitCode = 4;
    return;
  }
  if (!withModel) {
    process.stdout.write(`${JSON.stringify({
      mode: assembly.workingSet.mutationMode,
      verdict: targetCase ? "TARGET_ASSEMBLY_ONLY" : "ASSEMBLY_ONLY",
      target: assembly.target,
      package: assembly.targetPackage,
      counts: assembly.counts,
      performance: assembly.performance,
      calendar: assembly.calendar,
      gmail: assembly.gmail,
      scopeCoverage: assembly.scopeCoverage,
      evidenceCompleteness: assembly.completeness,
    }, null, 2)}\n`);
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!apiKey) {
    process.stdout.write(`${JSON.stringify({
      mode: assembly.requestWorkingSet.mutationMode,
      verdict: "MODEL_BLOCKED",
      reason: "missing-OPENAI_API_KEY",
      target: assembly.target,
      counts: assembly.counts,
      performance: assembly.performance,
      calendar: assembly.calendar,
      scopeCoverage: assembly.scopeCoverage,
      evidenceCompleteness: assembly.completeness,
    }, null, 2)}\n`);
    process.exitCode = 3;
    return;
  }
  const completion = await executeSterlingTodaySemantic({ assembly, apiKey,
    onStage: (stage, identifiers) => reportStage(stage, identifiers) });
  if (november11Reconciliation) {
    if (!completion.proposal) {
      process.stdout.write(`${JSON.stringify({
        contract: "sterling-operational-shadow-v11-sanitized-result-v1",
        verdict: "EVIDENCE_BLOCKED",
        evidenceCompleteness: assembly.completeness,
        blockedWorkUnitIds: completion.blockedWorkUnitIds,
      }, null, 2)}\n`);
      process.exitCode = 2;
      return;
    }
    const executionId = process.env.CONTINUUM_STERLING_OPERATIONAL_SHADOW_EXECUTION_ID?.trim() || "local-connector-shadow";
    const sanitized = buildSanitizedOperationalShadowResult({
      assembly,
      completion,
      runId: assembly.workingSet.runId,
      executionId,
      sourceCommit: process.env.CONTINUUM_SOURCE_COMMIT?.trim() || null,
      leaseMetadataWrite: false,
      browserSessionCache: false,
    });
    reportStage("validation_comparison_completed");
    process.stdout.write(`${JSON.stringify(sanitized.result, null, 2)}\n`);
    if (sanitized.verdict !== "GENERATED") process.exitCode = 2;
    return;
  }
  const proposal = completion.proposal;
  const result = {
    mode: assembly.requestWorkingSet.mutationMode,
    verdict: completion.verdict,
    target: assembly.target,
    counts: {
      ...assembly.counts,
      workUnits: assembly.requestWorkingSet.workUnits.length,
      assessments: proposal?.portfolioAssessments.length ?? 0,
      recommendations: proposal?.recommendations.length ?? 0,
      mutations: proposal?.proposedCanonicalMutations.length ?? 0,
    },
    performance: completion.performance,
    validation: completion.validation ? {
      accepted: completion.validation.accepted,
      errors: completion.validation.errors,
      mutations: completion.validation.mutationValidations,
    } : null,
    evidenceCompleteness: assembly.completeness,
    calendar: assembly.calendar,
    gmail: assembly.gmail,
    scopeCoverage: assembly.scopeCoverage,
    acceptance: completion.acceptance,
    operationalAcceptance: completion.operationalAcceptance,
    portfolio: proposal?.portfolioAssessments.map((item) => ({
      workUnitId: item.workUnitId,
      projectId: item.projectId,
      identityStatus: item.identityStatus,
      todayDisposition: item.todayDisposition,
      recommendationItemId: item.recommendationItemId,
      canonicalLifecycleStage: item.currentStage.canonicalLifecycleStage,
      operationalSubstage: item.currentStage.operationalSubstage,
      stageResponsibleParty: item.currentStage.responsibleParty,
      nextStepOwner: item.nextStepOwner,
      confidence: item.confidence,
      evidenceRefs: item.evidenceRefs,
      obligations: item.obligations.map((obligation) => ({
        obligationId: obligation.obligationId,
        status: obligation.status,
        responsibleParty: obligation.responsibleParty,
        confidence: obligation.confidence,
        evidenceRefs: obligation.evidenceRefs,
      })),
      ambiguityCount: item.ambiguities.length,
      omissionReasonPresent: Boolean(item.omissionReason),
    })) ?? [],
    presentation: proposal?.recommendations.map((item) => {
      const assessment = proposal.portfolioAssessments.find((row) => row.workUnitId === item.workUnitId);
      return {
        itemId: item.itemId,
        workUnitId: item.workUnitId,
        category: item.category,
        title: item.title,
        responsibleParty: assessment?.nextStepOwner ?? "unknown",
        confidence: item.confidence,
        projectId: item.projectId,
        evidenceRefs: item.evidenceRefs,
      };
    }) ?? [],
    relationshipProposals: proposal?.relationshipProposals ?? [],
    proposedWriteSet: proposal?.proposedCanonicalMutations ?? [],
    portfolioAmbiguities: proposal?.portfolioAmbiguities ?? [],
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (completion.verdict !== "PASS" && completion.verdict !== "TARGET_VALID") process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
