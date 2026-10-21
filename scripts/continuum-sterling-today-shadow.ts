/** READ-ONLY live Sterling-native Today replay. No canonical or snapshot writes. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF } from "../lib/continuum/runtime-env";
import { assembleSterlingTodayShadow, executeSterlingTodaySemantic } from "../lib/continuum/today-sterling/server-runner";

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

async function main() {
  const withModel = process.argv.includes("--with-model");
  const targetCase = process.argv.find((argument) => argument.startsWith("--target-case="))
    ?.slice("--target-case=".length) ?? null;
  const url = required("SUPABASE_URL");
  if (!url.includes(CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF)) {
    throw new Error("shadow-refuses-non-production-supabase");
  }
  const client = createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const assembly = await assembleSterlingTodayShadow({ client, targetCase });
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
  const completion = await executeSterlingTodaySemantic({ assembly, apiKey });
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
    portfolioAmbiguities: proposal?.portfolioAmbiguities ?? [],
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (completion.verdict !== "PASS" && completion.verdict !== "TARGET_VALID") process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
