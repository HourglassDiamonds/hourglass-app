/** READ-ONLY live Sterling-native Today replay. No canonical or snapshot writes. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { collectPagedRows } from "../lib/continuum/candidates/page";
import { rowToCandidate } from "../lib/continuum/candidates/rows";
import { CONTINUUM_CANDIDATES_TABLE } from "../lib/continuum/candidates/activation";
import type { ContinuumCandidate } from "../lib/continuum/candidates/types";
import { SupabaseProjectDeskReader } from "../lib/continuum/client-memory/project-desk/supabase";
import { loadProjectJobs } from "../lib/continuum/client-memory/project-jobs/load";
import { loadTodayKnownEmailPeople } from "../lib/continuum/client-memory/today-known-people";
import { loadFounderCorrectionEvents } from "../lib/continuum/chief-of-staff/operating-loop/founder-corrections-load";
import { loadIndexedTodayThreadContext, loadLiveTodayOperationalFacts } from "../lib/continuum/gmail/today-thread-context";
import { loadTodayUpcoming } from "../lib/continuum/calendar/today-upcoming-load";
import { isCalendarReadEnabled, isContinuumCalendarOAuthConfigured,
  getContinuumCalendarTokenKek, getContinuumCalendarFounderEmail } from "../lib/continuum/calendar/env";
import { readTodaySourceWatermark } from "../lib/continuum/today-source-watermark";
import { CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF } from "../lib/continuum/runtime-env";
import { conciergeForegroundModel } from "../lib/continuum/concierge-sol/models";
import { buildSterlingTodayWorkingSet } from "../lib/continuum/today-sterling/working-set";
import { requestSterlingTodayProposal } from "../lib/continuum/today-sterling/request";
import { validateSterlingTodayProposal } from "../lib/continuum/today-sterling/validate";
import { evaluateSterlingTodayAcceptance } from "../lib/continuum/today-sterling/acceptance";
import { expandSterlingIndexedThreadContext, loadSterlingProjectThreadIds } from "../lib/continuum/today-sterling/evidence-load";
import { buildSterlingTodayTargetWorkingSet, summarizeSterlingTodayTargetPackage } from "../lib/continuum/today-sterling/target";
import type { SterlingPreviousTodayItem } from "../lib/continuum/today-sterling/types";

const ACCEPTANCE_CASES = {
  abbey: { pattern: /\bAbbey\b|C026137/i, identifiers: ["C026137"] },
  sarah: { pattern: /\bSarah\b|C026143/i, identifiers: ["C026143"] },
  nathan: { pattern: /\bNath?an\b|\bNate\b|C026176/i, identifiers: ["C026176"] },
  alex: { pattern: /\bAlex\b|C026510/i, identifiers: ["C026510"] },
  madi: { pattern: /Madi\s+Rutledge|\bMadi\b|C026000|C017756/i, identifiers: ["C026000", "C017756"] },
  dylan: { pattern: /Dyl[ao]n|C025610/i, identifiers: ["C025610"] },
  grant: { pattern: /F\.?\s*Grant|C025885/i, identifiers: ["C025885"] },
  pennock: { pattern: /J\.?\s*Pennock|C025519/i, identifiers: ["C025519"] },
  duane: { pattern: /\bDuane\b|C026350/i, identifiers: ["C026350"] },
  timJenn: { pattern: /\bTim\b|\bJenn\b|C025964/i, identifiers: ["C025964"] },
} as const;

const acceptancePattern = new RegExp(
  Object.values(ACCEPTANCE_CASES).map(({ pattern }) => `(?:${pattern.source})`).join("|"), "i",
);

function projectText(project: { title: string; specs?: readonly { value: string }[] }) {
  return `${project.title} ${(project.specs ?? []).map((row) => row.value).join(" ")}`;
}

function candidateText(candidate: ContinuumCandidate) {
  return `${candidate.sourceRef} ${candidate.evidenceBasis.matchedText ?? ""} ${JSON.stringify(candidate.payload)} ${JSON.stringify(candidate.founderEditedPayload ?? {})}`;
}

function candidateProjectId(candidate: ContinuumCandidate): string | null {
  const target = candidate.founderEditedTarget ?? candidate.proposedTarget;
  return "projectId" in target ? target.projectId : null;
}

async function calendarDiagnostic(client: any) {
  const result = await client.from("continuum_calendar_connections")
    .select("status, refresh_token_ciphertext, granted_scope, last_read_at, status_error_code")
    .eq("calendar_slot", "founder-v1").maybeSingle();
  const row = result.data as Record<string, unknown> | null;
  const enabled = isCalendarReadEnabled();
  const connectionStatus = row?.status == null ? null : String(row.status);
  const diagnosis = !enabled ? "read_disabled"
    : result.error ? "connection_store_unavailable"
    : !row ? "consent_required"
    : connectionStatus !== "connected" ? `connection_${connectionStatus ?? "invalid"}`
    : !row.refresh_token_ciphertext ? "refresh_token_missing"
    : !getContinuumCalendarTokenKek() ? "token_kek_missing"
    : !isContinuumCalendarOAuthConfigured() ? "oauth_configuration_missing"
    : "live_read_eligible";
  return {
    diagnosis,
    readEnabled: enabled,
    oauthConfigured: isContinuumCalendarOAuthConfigured(),
    tokenKekConfigured: Boolean(getContinuumCalendarTokenKek()),
    founderMailboxConfigured: Boolean(getContinuumCalendarFounderEmail()),
    connectionStoreReadable: !result.error,
    connectionPresent: Boolean(row),
    connectionStatus,
    refreshTokenPresent: Boolean(row?.refresh_token_ciphertext),
    grantedReadonlyScope: String(row?.granted_scope ?? "").includes("calendar.readonly"),
    lastReadPresent: Boolean(row?.last_read_at),
    connectionErrorPresent: Boolean(row?.status_error_code),
  };
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

async function loadCandidates(client: any): Promise<ContinuumCandidate[]> {
  const rows = await collectPagedRows(async (from, to) => {
    const result = await client.from(CONTINUUM_CANDIDATES_TABLE).select("*").order("source_timestamp", { ascending: false }).range(from, to);
    if (result.error) throw result.error; return result.data ?? [];
  });
  return rows.flatMap(row => { try { return [rowToCandidate(row as Record<string, unknown>)]; } catch { return []; } });
}

async function loadPreviousToday(client: any): Promise<SterlingPreviousTodayItem[]> {
  const { data } = await client.from("continuum_today_snapshots").select("payload").eq("snapshot_key", "founder_today_v1").limit(1);
  const raw = data as unknown as Array<{ payload?: unknown }> | null;
  const payload = raw?.[0]?.payload as { docket?: { items?: unknown[]; watching?: unknown[] } } | undefined;
  const rows = [...(payload?.docket?.items ?? []), ...(payload?.docket?.watching ?? [])];
  return rows.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    return [{ itemId: String(row.id ?? `prior-${index}`), category: String(row.lane ?? "prior"),
      projectId: typeof row.projectId === "string" ? row.projectId : null,
      summary: String(row.headline ?? row.detail ?? row.title ?? row.subject ?? "Prior Today item").slice(0, 500) }];
  });
}

async function main() {
  const runStarted = Date.now();
  const withModel = process.argv.includes("--with-model");
  const targetCase = process.argv.find(argument => argument.startsWith("--target-case="))?.slice("--target-case=".length) ?? null;
  const url = required("SUPABASE_URL");
  if (!url.includes(CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF)) throw new Error("shadow-refuses-non-production-supabase");
  const client = createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const now = new Date();
  const [candidates, projects, jobs, people, corrections, calendar, watermark, previousToday, calendarStatus] = await Promise.all([
    loadCandidates(client), new SupabaseProjectDeskReader(client as never).listProjects(), loadProjectJobs(client as never),
    loadTodayKnownEmailPeople(), loadFounderCorrectionEvents(client as never), loadTodayUpcoming(now),
    readTodaySourceWatermark(client as never, now), loadPreviousToday(client), calendarDiagnostic(client),
  ]);
  const scopedProjects = projects.filter((project) => acceptancePattern.test(projectText(project)));
  const scopedProjectIds = new Set(scopedProjects.map((project) => project.projectId));
  const scopedCandidates = candidates.filter((candidate) => {
    const target = candidate.founderEditedTarget ?? candidate.proposedTarget;
    return ("projectId" in target && target.projectId != null && scopedProjectIds.has(target.projectId)) || acceptancePattern.test(candidateText(candidate));
  });
  const scopedJobs = (jobs ?? []).filter((job) =>
    (job.projectId != null && scopedProjectIds.has(job.projectId)) || acceptancePattern.test(`${job.subject} ${job.detail ?? ""}`));
  const scopedPeopleIds = new Set(scopedProjects.flatMap((project) => project.people.map((person) => person.personId)));
  const scopedPeople = people.filter((person) => scopedPeopleIds.has(person.personId) || acceptancePattern.test(person.displayName));
  const scopedCorrections = corrections.filter((row) =>
    (row.projectId != null && scopedProjectIds.has(row.projectId)) || acceptancePattern.test(`${row.subject ?? ""} ${row.authorOwnedText ?? ""} ${row.evidenceExcerpt ?? ""}`));
  const scopedCalendar = calendar.filter((row) => acceptancePattern.test(`${row.title} ${row.location ?? ""}`));
  const scopedPreviousToday = previousToday.filter((row) =>
    (row.projectId != null && scopedProjectIds.has(row.projectId)) || acceptancePattern.test(row.summary));
  const projectEvidenceThreads = await loadSterlingProjectThreadIds(client as never, scopedProjects);
  const projectThreadIds = projectEvidenceThreads.trustedByProject;
  const trustedProjectThreads = [...new Set([...projectThreadIds.values()].flat())];
  const indexed = await expandSterlingIndexedThreadContext(client as never,
    await loadIndexedTodayThreadContext(scopedCandidates),
    [...trustedProjectThreads, ...projectEvidenceThreads.discoveryThreadIds]);
  const threadContext = await loadLiveTodayOperationalFacts(indexed);
  const workingSet = buildSterlingTodayWorkingSet({ sourceWatermark: watermark, generatedAt: now.toISOString(),
    projects: scopedProjects, jobs: scopedJobs, candidates: scopedCandidates, threadContext, knownPeople: scopedPeople,
    founderCorrections: scopedCorrections, calendar: scopedCalendar,
    calendarAvailability: { status: calendarStatus.diagnosis === "live_read_eligible" ? "available"
      : calendarStatus.diagnosis === "read_disabled" ? "disabled" : "unavailable", reason: calendarStatus.diagnosis },
    previousToday: scopedPreviousToday, projectThreadIds });
  const assemblyLatencyMs = Date.now() - runStarted;
  const serializedInputBytes = Buffer.byteLength(JSON.stringify(workingSet));
  const allIdentifiers = [...new Set(Object.values(ACCEPTANCE_CASES).flatMap((row) => [...row.identifiers]))];
  const [byCad, byOrder] = await Promise.all([
    client.from("continuum_project_history").select("project_id, cad_job_number, order_number").in("cad_job_number", allIdentifiers),
    client.from("continuum_project_history").select("project_id, cad_job_number, order_number").in("order_number", allIdentifiers),
  ]);
  const identifierRows = [...(byCad.data ?? []), ...(byOrder.data ?? [])];
  const caseCoverage = Object.fromEntries(Object.entries(ACCEPTANCE_CASES).map(([name, definition]) => {
    const pattern = definition.pattern;
    const projectIds = workingSet.projects.filter(project => pattern.test(`${project.title} ${project.specs.map(spec => spec.value).join(" ")}`)).map(project => project.projectId);
    const trustedProjectThreads = projectIds.reduce((count, id) => count + (projectThreadIds.get(id)?.length ?? 0), 0);
    const evidence = workingSet.evidence.filter(row => row.projectIds.some(id => projectIds.includes(id)) || pattern.test(`${row.subject ?? ""} ${row.excerpt ?? ""}`)).length;
    const canonicalIdentifierProjects = new Set(identifierRows.filter((row) => definition.identifiers.includes(String(row.cad_job_number ?? "") as never) ||
      definition.identifiers.includes(String(row.order_number ?? "") as never)).map((row) => String(row.project_id))).size;
    const canonicalPeople = workingSet.people.filter((person) => pattern.test(person.displayName)).length;
    const relationships = workingSet.projects.filter((project) => projectIds.includes(project.projectId)).reduce((count, project) => count + project.people.length, 0);
    const caseCandidates = scopedCandidates.filter((candidate) => pattern.test(candidateText(candidate)) ||
      (candidateProjectId(candidate) != null && projectIds.includes(candidateProjectId(candidate)!)));
    const newProjectCandidates = caseCandidates.filter((candidate) => candidate.payload.kind === "project_context" && candidate.payload.topic === "new_project");
    const promotionDiagnosis = projectIds.length > 0 ? "canonical_project_present"
      : newProjectCandidates.some((candidate) => candidate.reviewStatus === "approved") ? "approved_candidate_not_applied"
      : newProjectCandidates.some((candidate) => candidate.reviewStatus === "pending") ? "awaiting_founder_promotion"
      : caseCandidates.length > 0 ? "evidence_ingested_without_project_proposal"
      : "candidate_ingestion_missing";
    const linkage = projectIds.length === 0 ? (canonicalIdentifierProjects > 0 ? "history_without_project_profile" : canonicalPeople > 0 ? "person_only_no_project" : "canonical_project_absent")
      : relationships === 0 ? "project_missing_client_relationship"
      : trustedProjectThreads === 0 ? "project_without_trusted_thread"
      : "canonical_project_and_thread_resolved";
    const associationDiagnostics = projectIds.map((id) => projectEvidenceThreads.diagnosticsByProject.get(id)).filter(Boolean);
    const workUnitIds = workingSet.workUnits.filter(unit => pattern.test([
      unit.label, ...unit.observedIdentifiers,
      ...unit.evidenceRefs.flatMap(ref => {
        const row = workingSet.evidence.find(evidence => evidence.evidenceId === ref);
        return [row?.subject ?? "", row?.excerpt ?? "", ...(row?.attachmentFilenames ?? [])];
      }),
    ].join(" "))).map(unit => unit.workUnitId);
    return [name, { projects: projectIds.length, canonicalIdentifierProjects, canonicalPeople, relationships,
      trustedProjectThreads, evidence, workUnitIds, linkage, candidates: caseCandidates.length,
      candidateReview: { pending: caseCandidates.filter((row) => row.reviewStatus === "pending").length,
        approved: caseCandidates.filter((row) => row.reviewStatus === "approved").length,
        discarded: caseCandidates.filter((row) => row.reviewStatus === "discarded").length,
        deferred: caseCandidates.filter((row) => row.reviewStatus === "deferred").length },
      newProjectCandidates: newProjectCandidates.length, promotionDiagnosis, associationDiagnostics }];
  }));
  let requestWorkingSet = workingSet;
  let targetDiagnostics: { caseId: string; selectedWorkUnitId: string; relatedWorkUnitIds: string[] } | null = null;
  if (targetCase) {
    if (!(targetCase in ACCEPTANCE_CASES)) throw new Error(`sterling-target-unknown-case:${targetCase}`);
    const definition = ACCEPTANCE_CASES[targetCase as keyof typeof ACCEPTANCE_CASES];
    const evidenceById = new Map(workingSet.evidence.map(row => [row.evidenceId, row]));
    const matching = workingSet.workUnits.filter(unit => definition.pattern.test([
      unit.label, ...unit.observedIdentifiers,
      ...unit.evidenceRefs.flatMap(ref => {
        const row = evidenceById.get(ref);
        return [row?.subject ?? "", row?.excerpt ?? "", ...(row?.attachmentFilenames ?? [])];
      }),
    ].join(" ")));
    const exact = matching.filter(unit => unit.observedIdentifiers.some(id => definition.identifiers.includes(id as never)));
    const canonical = matching.filter(unit => unit.kind === "canonical_project");
    const selected = exact.length === 1 ? exact[0] : canonical.length === 1 ? canonical[0]
      : matching.length === 1 ? matching[0] : null;
    if (!selected) {
      process.stdout.write(`${JSON.stringify({ mode: workingSet.mutationMode, verdict: "TARGET_BLOCKED",
        targetCase, reason: matching.length === 0 ? "no-matching-work-unit" : "ambiguous-work-unit",
        relatedWorkUnitIds: matching.map(row => row.workUnitId) }, null, 2)}\n`);
      process.exitCode = 4;
      return;
    }
    requestWorkingSet = buildSterlingTodayTargetWorkingSet(workingSet, selected.workUnitId);
    targetDiagnostics = { caseId: targetCase, selectedWorkUnitId: selected.workUnitId,
      relatedWorkUnitIds: matching.map(row => row.workUnitId) };
    if (!withModel) {
      process.stdout.write(`${JSON.stringify({ mode: requestWorkingSet.mutationMode, verdict: "TARGET_ASSEMBLY_ONLY",
        target: targetDiagnostics, package: summarizeSterlingTodayTargetPackage(requestWorkingSet),
        performance: { assemblyLatencyMs, serializedInputBytes: Buffer.byteLength(JSON.stringify(requestWorkingSet)),
          totalLatencyMs: Date.now() - runStarted } }, null, 2)}\n`);
      return;
    }
  }
  if (!withModel) {
    process.stdout.write(`${JSON.stringify({ mode: workingSet.mutationMode, verdict: "ASSEMBLY_ONLY",
      counts: { people: workingSet.people.length, projects: workingSet.projects.length, jobs: workingSet.jobs.length,
        evidence: workingSet.evidence.length, workUnits: workingSet.workUnits.length,
        gmailThreads: threadContext.size, calendar: workingSet.calendar.length },
      performance: { assemblyLatencyMs, serializedInputBytes, totalLatencyMs: Date.now() - runStarted },
      calendar: { ...calendarStatus, todayItemsBeforeAcceptanceScope: calendar.length, scopedTodayItems: workingSet.calendar.length },
      caseCoverage }, null, 2)}\n`);
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!apiKey) {
    process.stdout.write(`${JSON.stringify({ mode: requestWorkingSet.mutationMode, verdict: "MODEL_BLOCKED", reason: "missing-OPENAI_API_KEY",
      target: targetDiagnostics,
      counts: { people: requestWorkingSet.people.length, projects: requestWorkingSet.projects.length, jobs: requestWorkingSet.jobs.length,
        evidence: requestWorkingSet.evidence.length, workUnits: requestWorkingSet.workUnits.length,
        gmailThreads: threadContext.size, calendar: requestWorkingSet.calendar.length },
      performance: { assemblyLatencyMs, serializedInputBytes, totalLatencyMs: Date.now() - runStarted },
      calendar: { ...calendarStatus, todayItemsBeforeAcceptanceScope: calendar.length, scopedTodayItems: workingSet.calendar.length },
      caseCoverage }, null, 2)}\n`);
    process.exitCode = 3; return;
  }
  const completion = await requestSterlingTodayProposal({ apiKey,
    model: conciergeForegroundModel(process.env.CONTINUUM_STERLING_TODAY_MODEL), workingSet: requestWorkingSet });
  const validation = validateSterlingTodayProposal(requestWorkingSet, completion.proposal);
  const acceptance = targetDiagnostics ? null : evaluateSterlingTodayAcceptance(requestWorkingSet, completion.proposal);
  const result = {
    mode: requestWorkingSet.mutationMode,
    verdict: targetDiagnostics
      ? validation.accepted ? "TARGET_VALID" : "BLOCK"
      : validation.accepted && acceptance?.passed ? "PASS" : "BLOCK",
    target: targetDiagnostics,
    counts: { people: requestWorkingSet.people.length, projects: requestWorkingSet.projects.length, jobs: requestWorkingSet.jobs.length,
      evidence: requestWorkingSet.evidence.length, gmailThreads: threadContext.size, calendar: requestWorkingSet.calendar.length,
      workUnits: requestWorkingSet.workUnits.length, assessments: completion.proposal.portfolioAssessments.length,
      recommendations: completion.proposal.recommendations.length, mutations: completion.proposal.proposedCanonicalMutations.length },
    performance: { assemblyLatencyMs, modelLatencyMs: completion.latencyMs, inputBytes: completion.inputBytes,
      outputBytes: completion.outputBytes, tokenUsage: completion.usage, totalLatencyMs: Date.now() - runStarted },
    validation: { accepted: validation.accepted, errors: validation.errors, mutations: validation.mutationValidations },
    calendar: { ...calendarStatus, todayItemsBeforeAcceptanceScope: calendar.length, scopedTodayItems: workingSet.calendar.length },
    acceptance,
    portfolio: completion.proposal.portfolioAssessments.map(item => ({ workUnitId: item.workUnitId,
      projectId: item.projectId, identityStatus: item.identityStatus, todayDisposition: item.todayDisposition,
      recommendationItemId: item.recommendationItemId,
      canonicalLifecycleStage: item.currentStage.canonicalLifecycleStage,
      operationalSubstage: item.currentStage.operationalSubstage,
      stageResponsibleParty: item.currentStage.responsibleParty, nextStepOwner: item.nextStepOwner,
      confidence: item.confidence, evidenceRefs: item.evidenceRefs,
      obligations: item.obligations.map(obligation => ({ obligationId: obligation.obligationId, status: obligation.status,
        responsibleParty: obligation.responsibleParty, confidence: obligation.confidence, evidenceRefs: obligation.evidenceRefs })),
      ambiguityCount: item.ambiguities.length, omissionReasonPresent: Boolean(item.omissionReason) })),
    presentation: completion.proposal.recommendations.map(item => {
      const assessment = completion.proposal.portfolioAssessments.find(row => row.workUnitId === item.workUnitId);
      return { itemId: item.itemId, workUnitId: item.workUnitId, category: item.category,
        title: item.title, responsibleParty: assessment?.nextStepOwner ?? "unknown", confidence: item.confidence,
        projectId: item.projectId, evidenceRefs: item.evidenceRefs };
    }),
    portfolioAmbiguities: completion.proposal.portfolioAmbiguities,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.verdict !== "PASS") process.exitCode = 2;
}

main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
