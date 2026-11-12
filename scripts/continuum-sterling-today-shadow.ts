/** READ-ONLY live Sterling-native Today replay. No canonical or snapshot writes. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";
import { CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF } from "../lib/continuum/runtime-env";
import { assembleSterlingTodayShadow, executeSterlingTodaySemantic } from "../lib/continuum/today-sterling/server-runner";
import { NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS } from "../lib/continuum/today-sterling/operational-reconciliation-scope";

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

type ConnectorMessage = {
  messageId: string;
  sentAt: string;
  fromRaw: string | null;
  to: string | null;
  cc: string | null;
  subject: string | null;
  plainText: string | null;
  bodyExtractionStatus: "decoded_plaintext" | "empty";
  snippet: string | null;
  attachments: readonly { filename: string | null; mimeType: string | null }[];
};

function connectorRecipients(value: string | null): string[] {
  return value?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
}

async function connectorBatchFromStdin() {
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let payload = "";
  for await (const line of input) {
    payload = line;
    break;
  }
  input.close();
  if (!payload) throw new Error("connector-stdin-empty");
  const parsed = JSON.parse(payload) as Record<string, ConnectorMessage[]>;
  const allowedThreadIds = new Set<string>(NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS);
  const unexpectedThreadIds = Object.keys(parsed).filter((threadId) => !allowedThreadIds.has(threadId));
  if (unexpectedThreadIds.length > 0) {
    throw new Error("connector-stdin-thread-outside-november-11-allowlist");
  }
  const metrics = { threadFetches: 0 };
  return {
    credentialLoads: 1 as const,
    metrics,
    async fetchThread(input: { threadId: string; indexed: readonly { messageId: string; subject: string | null }[] }) {
      metrics.threadFetches += 1;
      const available = new Map((parsed[input.threadId] ?? []).map((message) => [message.messageId, message]));
      const messages = input.indexed.flatMap((indexed) => {
        const message = available.get(indexed.messageId);
        return message ? [{
          messageId: message.messageId,
          fromRaw: message.fromRaw,
          fromEmail: null,
          to: connectorRecipients(message.to),
          cc: connectorRecipients(message.cc),
          subject: message.subject,
          sentAt: message.sentAt,
          plainText: message.plainText,
          bodyExtractionStatus: message.bodyExtractionStatus,
          snippet: message.snippet,
          attachments: message.attachments,
        }] : [];
      });
      if (messages.length === 0) return { ok: false as const, safeErrorCode: "not-indexed" as const };
      return {
        ok: true as const,
        safeErrorCode: null,
        threadId: input.threadId,
        indexedSubject: input.indexed.at(-1)?.subject ?? null,
        messages,
        plaintextPersisted: false as const,
        gmailMutation: false as const,
        cursorUnchanged: true as const,
        readOnly: true as const,
      };
    },
  };
}

async function main() {
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
    } : {}),
    ...(connectorStdin ? { createGmailBatch: connectorBatchFromStdin } : {}),
  });
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
