/**
 * Deterministic Continuum Preview acceptance fixture.
 *
 * This utility is intentionally server-only and refuses every target except the
 * dedicated Continuum Preview Supabase project. It never reads or copies
 * Production data. `--reset` restores mutable fixture rows to the same baseline;
 * immutable repair-quote snapshots are inserted once and verified thereafter.
 */
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { calculateRepairQuote } from "../lib/continuum/repair-quoting/calculate";
import { lookupCatalogSku } from "../lib/continuum/repair-quoting/catalog";
import { GELLER_BLUE_BOOK, GELLER_COST_BASIS } from "../lib/continuum/repair-quoting/contract";

export const PREVIEW_REF = "hrmpzplffuhhvbtxxhnt";
export const PRODUCTION_REF = "bnafadfgrrriblppeubp";
export const FIXTURE_MARKER = "continuum-preview-acceptance-v1";

const ids = {
  people: Array.from({ length: 6 }, (_, index) => `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`),
  projects: Array.from({ length: 6 }, (_, index) => `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`),
  jobs: Array.from({ length: 9 }, (_, index) => `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`),
  jobMutations: Array.from({ length: 9 }, (_, index) => `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`),
  proposals: Array.from({ length: 5 }, (_, index) => `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`),
  holds: Array.from({ length: 2 }, (_, index) => `60000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`),
  quotes: Array.from({ length: 3 }, (_, index) => `70000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`),
  quoteMutations: Array.from({ length: 3 }, (_, index) => `80000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`),
  relationships: Array.from({ length: 6 }, (_, index) => `90000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`),
  evidence: Array.from({ length: 3 }, (_, index) => `a0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`),
  runs: Array.from({ length: 5 }, (_, index) => `b0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`),
} as const;

export type PreviewFixtureEnv = {
  CONTINUUM_ENV?: string;
  CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF?: string;
  CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export function assertPreviewFixtureTarget(env: PreviewFixtureEnv): void {
  const previewRef = env.CONTINUUM_PREVIEW_SUPABASE_PROJECT_REF?.trim();
  const productionRef = env.CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF?.trim();
  let urlRef: string | null = null;
  try {
    urlRef = new URL(env.SUPABASE_URL ?? "").hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1]?.toLowerCase() ?? null;
  } catch {
    urlRef = null;
  }
  if (env.CONTINUUM_ENV?.trim() !== "preview") throw new Error("preview-fixture-refused: CONTINUUM_ENV must be preview");
  if (previewRef !== PREVIEW_REF) throw new Error("preview-fixture-refused: unexpected Preview project ref");
  if (productionRef !== PRODUCTION_REF) throw new Error("preview-fixture-refused: unexpected Production denylist ref");
  if (previewRef === productionRef || urlRef === PRODUCTION_REF) throw new Error("preview-fixture-refused: Production target");
  if (urlRef !== PREVIEW_REF) throw new Error("preview-fixture-refused: SUPABASE_URL is not Continuum Preview");
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || key.startsWith("sb_publishable_")) throw new Error("preview-fixture-refused: privileged Preview credential required");
}

function loadLocalPreviewEnv(): void {
  const path = ".env.continuum-preview.local";
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith("#")) continue;
    const split = value.indexOf("=");
    if (split <= 0) continue;
    const key = value.slice(0, split).trim();
    if (process.env[key]?.trim()) continue;
    process.env[key] = value.slice(split + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

function localDate(offset: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, day + offset, 12)).toISOString().slice(0, 10);
}

function iso(dayOffset: number, hour = 14): string {
  return `${localDate(dayOffset)}T${String(hour).padStart(2, "0")}:00:00.000Z`;
}

const sha = (value: string) => value.repeat(64).slice(0, 64);

function proposalRow(input: {
  index: number;
  jobIndex: number;
  status: "proposed" | "deferred" | "rejected" | "executed";
  kind?: "job_update" | "conditional_hold";
}) {
  const proposalId = ids.proposals[input.index];
  const jobId = ids.jobs[input.jobIndex];
  const createdAt = iso(-1, 15 + input.index);
  const proposedAction = input.kind === "conditional_hold"
    ? { kind: "activate_hold", holdId: ids.holds[input.index - 3], projectId: ids.projects[input.jobIndex], jobId, expectedUpdatedAt: iso(-1), reason: "Synthetic Preview hold", condition: { kind: "until_time", resumeAt: iso(1), timezone: "America/New_York" }, sourceRefs: [`${FIXTURE_MARKER}:hold`] }
    : { kind: "update_job", projectId: ids.projects[input.jobIndex] ?? null, jobId, expectedUpdatedAt: iso(-1), dueAt: localDate(1) };
  const original = {
    proposalId,
    kind: input.kind ?? "job_update",
    affectedEntity: { kind: "job", id: jobId },
    currentState: "Synthetic Preview baseline",
    proposedState: input.kind === "conditional_hold" ? "Held until condition" : "Due tomorrow",
    reason: "Deterministic Preview acceptance proposal",
    evidence: [`${FIXTURE_MARKER}:evidence`],
    expectedDownstreamEffect: "Exercises founder proposal controls in Preview only",
    status: "review-required",
    canApplyWithExistingWriter: true,
    confidence: "high",
    currentStateFingerprint: sha(String(input.index + 1)),
    currentStateSnapshot: { fixture: FIXTURE_MARKER, jobId },
    proposedAction,
    persistence: "persisted",
  };
  const decided = input.status !== "proposed";
  const executed = input.status === "executed";
  return {
    proposal_id: proposalId,
    created_at: createdAt,
    updated_at: createdAt,
    proposal_type: input.kind ?? "job_update",
    status: input.status,
    affected_entity_type: "job",
    affected_entity_id: jobId,
    current_state_fingerprint: sha(String(input.index + 1)),
    current_state_snapshot: { fixture: FIXTURE_MARKER, jobId },
    entity_version: iso(-1),
    original_proposal: original,
    evidence_refs: [`${FIXTURE_MARKER}:evidence`],
    reasoning_summary: "Synthetic Preview-only proposal for interaction acceptance.",
    confidence: "high",
    source_workflow: FIXTURE_MARKER,
    source_watermark: `${FIXTURE_MARKER}:watermark`,
    provider: "openai",
    model: "synthetic-preview-fixture",
    model_configuration: "deterministic",
    run_id: ids.runs[input.index],
    trace_id: `${FIXTURE_MARKER}:${input.index + 1}`,
    founder_decision: decided ? (input.status === "executed" ? "approved" : input.status) : null,
    founder_decision_at: decided ? createdAt : null,
    founder_decision_note: decided ? "Synthetic Preview decision" : null,
    founder_edited_payload: null,
    defer_until: input.status === "deferred" ? iso(2) : null,
    canonical_mutation_id: executed ? ids.jobMutations[input.jobIndex] : null,
    executed_payload: executed ? proposedAction : null,
    execution_status: executed ? "executed" : "not_requested",
    execution_error_category: null,
    superseded_by: null,
    replaces_proposal_id: null,
    executed_at: executed ? createdAt : null,
    ledger_version: "sterling-ledger-v1",
    contract_version: "sterling-v1",
    prompt_version: "sterling-grounding-v1",
  };
}

export function buildPreviewAcceptanceFixture() {
  const names = [
    "Preview Client — CAD Review",
    "Preview Client — Waiting on Shop",
    "Preview Client — Waiting on Client",
    "Preview Client — Founder Action",
    "Preview Repair Quote",
    "Preview Held Item",
  ];
  const titles = [
    "Preview Project — CAD Review",
    "Preview Project — Waiting on Shop",
    "Preview Project — Waiting on Client",
    "Preview Project — Founder Action",
    "Preview Project — Repair Quote",
    "Preview Project — Held Item",
  ];
  const jobs = [
    [0, "Review synthetic CAD and send feedback", "founder", "open", localDate(0), null, "action"],
    [3, "Confirm synthetic founder action", "founder", "open", localDate(0), null, "action"],
    [null, "Return synthetic projectless call", "founder", "open", localDate(0), null, "action"],
    [2, "Await synthetic client approval", "client", "open", null, null, "watching"],
    [1, "Await synthetic shop update", "vendor", "open", null, null, "watching"],
    [5, "Synthetic item currently held", "founder", "open", localDate(1), null, "action"],
    [0, "Synthetic hold condition met", "founder", "open", localDate(1), null, "action"],
    [3, "Synthetic snoozed follow-up", "founder", "snoozed", null, iso(1), "action"],
    [2, "Review synthetic low-priority noise", "unknown", "open", null, null, "watching"],
  ] as const;
  const metadata = (label: string) => ({
    version: 1,
    timingPrecision: "exact-instant",
    timezone: "America/New_York",
    originalWording: label,
    referenceInstant: iso(0),
    originalLocalDateTime: `${localDate(0)} 10:00`,
    conditionPolicy: "review-only",
    assumptions: ["Synthetic Preview acceptance data"],
    unscheduledConfirmed: true,
    sourceReference: `${FIXTURE_MARKER}:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  });
  const jobRows = jobs.map(([projectIndex, subject, actor, state, dueAt, deferredUntil, attentionMode], index) => ({
    job_id: ids.jobs[index],
    project_id: projectIndex == null ? null : ids.projects[projectIndex],
    kind: index === 2 ? "commitment" : "required_action",
    subject,
    detail: `Clearly synthetic fixture row (${FIXTURE_MARKER}).`,
    waiting_on_actor: actor,
    associated_person_id: projectIndex == null ? ids.people[3] : ids.people[projectIndex],
    state,
    due_at: dueAt,
    deferred_until: deferredUntil,
    resolved_at: null,
    cancelled_at: null,
    created_at: iso(-2),
    updated_at: iso(-1),
    created_by: "preview-fixture",
    source_system: "continuum",
    source_ref: `${FIXTURE_MARKER}:job:${index + 1}`,
    created_mutation_id: ids.jobMutations[index],
    attention_mode: attentionMode,
    activation_at: null,
    checkpoint_at: attentionMode === "watching" ? iso(1) : null,
    attention_metadata: attentionMode === "watching" ? metadata(subject) : null,
  }));
  const catalog = lookupCatalogSku("1008");
  if (!catalog) throw new Error("preview-fixture: verified repair SKU 1008 unavailable");
  const calculated = calculateRepairQuote({
    repairType: "sizing",
    metalFamily: "gold_14k",
    line: { sku: catalog.sku, taskDescription: catalog.taskDescription, amounts: catalog.amounts, metalSemantics: catalog.metalSemantics, expressSelected: false, costBasis: GELLER_COST_BASIS },
  });
  if (!calculated.ok) throw new Error(`preview-fixture: repair calculation failed (${calculated.code})`);
  const quoteStates = ["draft", "issued", "voided"] as const;
  const quoteRows = quoteStates.map((state, index) => ({
    quote_id: ids.quotes[index],
    project_id: ids.projects[4],
    quote_number: index + 1,
    state,
    repair_type: "sizing",
    metal_family: "gold_14k",
    associated_person_id: ids.people[4],
    source_edition_label: GELLER_BLUE_BOOK.editionLabel,
    source_sku: catalog.sku,
    line: calculated.calculation.line,
    calculation: calculated.calculation,
    override: null,
    issued_at: state === "issued" ? iso(-2) : null,
    issued_by: state === "issued" ? "preview-fixture" : null,
    voided_at: state === "voided" ? iso(-1) : null,
    voided_by: state === "voided" ? "preview-fixture" : null,
    created_at: iso(-3),
    updated_at: iso(-1),
    created_by: "preview-fixture",
    created_mutation_id: ids.quoteMutations[index],
    issued_mutation_id: state === "issued" ? ids.quoteMutations[index] : null,
  }));
  return {
    entities: [
      ...ids.people.map((id) => ({ id, kind: "person", created_at: iso(-3), created_by: "preview-fixture" })),
      ...ids.projects.map((id) => ({ id, kind: "project", created_at: iso(-3), created_by: "preview-fixture" })),
    ],
    people: ids.people.map((person_id, index) => ({ person_id, display_name: names[index], given_name: "Preview", family_name: `Synthetic ${index + 1}`, roles: ["client"], source_system: FIXTURE_MARKER, created_at: iso(-3), updated_at: iso(-1) })),
    projects: ids.projects.map((project_id, index) => ({ project_id, display_title: titles[index], visibility: "internal-only", import_row_key: `${FIXTURE_MARKER}:project:${index + 1}`, source_system: FIXTURE_MARKER, created_at: iso(-3), updated_at: iso(-1), project_kind: index === 4 ? "repair_service" : "custom_new_jewelry" })),
    relationships: ids.relationships.map((id, index) => ({ id, from_entity_id: ids.people[index], to_entity_id: ids.projects[index], kind: "client-project", status: "active", source_system: FIXTURE_MARKER, created_at: iso(-3), created_by: "preview-fixture" })),
    lifecycle: ids.projects.map((project_id, index) => ({ project_id, project_kind: index === 4 ? "repair_service" : "custom_new_jewelry", stage: index === 4 ? "estimate" : index === 0 ? "cad" : index === 1 ? "production" : index === 2 ? "client_approval" : "design", entered_at: iso(-2), created_at: iso(-3), updated_at: iso(-1) })),
    jobs: jobRows,
    jobMutations: jobRows.map((row, index) => ({ mutation_id: ids.jobMutations[index], job_id: row.job_id, project_id: row.project_id, action: "create", prior_state: null, new_state: row.state, changed_at: row.created_at, changed_by: "preview-fixture", source_system: "continuum", operation: { version: 2, fixture: FIXTURE_MARKER } })),
    evidence: ids.evidence.map((id, index) => ({ id, schema_version: 1, source_system: FIXTURE_MARKER, source_kind: "source-record", source_record_id: `${FIXTURE_MARKER}:${index + 1}`, event_id: null, observation_id: null, collected_at: iso(-1), freshness: "fresh", reliability: "reliable", redaction_status: "clean", summary: `Synthetic Preview evidence ${index + 1}`, supporting_pointer: `${FIXTURE_MARKER}:evidence:${index + 1}`, idempotency_key: `${FIXTURE_MARKER}:evidence:${index + 1}`, claim_fingerprint: sha(String(index + 7)) })),
    proposals: [proposalRow({ index: 0, jobIndex: 0, status: "proposed" }), proposalRow({ index: 1, jobIndex: 1, status: "deferred" }), proposalRow({ index: 2, jobIndex: 2, status: "rejected" }), proposalRow({ index: 3, jobIndex: 5, status: "executed", kind: "conditional_hold" }), proposalRow({ index: 4, jobIndex: 6, status: "executed", kind: "conditional_hold" })],
    holds: [
      { hold_id: ids.holds[0], entity_type: "job", entity_id: ids.jobs[5], project_id: ids.projects[5], created_at: iso(-1), created_by: "preview-fixture", reason: "Synthetic Preview hold", condition: { kind: "until_time", resumeAt: iso(1), timezone: "America/New_York" }, source_refs: [`${FIXTURE_MARKER}:hold:1`], approval_proposal_id: ids.proposals[3], provenance: "sterling-founder-approved", activated_at: iso(-1), expected_entity_updated_at: iso(-1), current_state_fingerprint: sha("d"), status: "active", condition_met_at: null, resumed_at: null, resume_evidence: null },
      { hold_id: ids.holds[1], entity_type: "job", entity_id: ids.jobs[6], project_id: ids.projects[0], created_at: iso(-1), created_by: "preview-fixture", reason: "Synthetic condition has been met", condition: { kind: "until_time", resumeAt: iso(-1), timezone: "America/New_York" }, source_refs: [`${FIXTURE_MARKER}:hold:2`], approval_proposal_id: ids.proposals[4], provenance: "sterling-founder-approved", activated_at: iso(-2), expected_entity_updated_at: iso(-1), current_state_fingerprint: sha("e"), status: "condition_met", condition_met_at: iso(-1), resumed_at: null, resume_evidence: { sourceRef: `${FIXTURE_MARKER}:condition`, observedAt: iso(-1), summary: "Synthetic Preview condition met" } },
    ],
    quotes: quoteRows,
    quoteMutations: quoteRows.map((row, index) => ({ mutation_id: ids.quoteMutations[index], quote_id: row.quote_id, project_id: row.project_id, action: index === 0 ? "create" : index === 1 ? "issue" : "void", prior_state: index === 0 ? null : index === 1 ? "draft" : "issued", new_state: row.state, prior_hourglass_quote_eighth_cents: index === 0 ? null : calculated.calculation.hourglassQuoteEighthCents, new_hourglass_quote_eighth_cents: calculated.calculation.hourglassQuoteEighthCents, changed_at: row.updated_at, changed_by: "preview-fixture" })),
  };
}

async function write(client: SupabaseClient, table: string, rows: Record<string, unknown>[], onConflict: string) {
  const { error } = await client.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`preview-fixture-write:${table}:${formatDatabaseError(error)}`);
}

function formatDatabaseError(error: { code?: string; message?: string; details?: string; hint?: string }): string {
  return [error.code || "unknown", error.message, error.details, error.hint].filter(Boolean).join(":");
}

async function insertImmutableQuotes(client: SupabaseClient, rows: Record<string, unknown>[]) {
  const idsToCheck = rows.map((row) => String(row.quote_id));
  const { data, error } = await client.from("continuum_repair_quotes").select("quote_id,state,source_sku").in("quote_id", idsToCheck);
  if (error) throw new Error(`preview-fixture-read:continuum_repair_quotes:${formatDatabaseError(error)}`);
  const existing = new Map((data ?? []).map((row) => [String(row.quote_id), row]));
  for (const row of rows) {
    const prior = existing.get(String(row.quote_id));
    if (prior && (prior.state !== row.state || prior.source_sku !== row.source_sku)) throw new Error("preview-fixture-refused: immutable quote drift");
  }
  const missing = rows.filter((row) => !existing.has(String(row.quote_id)));
  if (!missing.length) return;
  const result = await client.from("continuum_repair_quotes").insert(missing);
  if (result.error) throw new Error(`preview-fixture-write:continuum_repair_quotes:${formatDatabaseError(result.error)}`);
}

export async function seedPreviewAcceptance(client: SupabaseClient): Promise<Record<string, number>> {
  const fixture = buildPreviewAcceptanceFixture();
  await write(client, "continuum_entities", fixture.entities, "id");
  await write(client, "continuum_person_profiles", fixture.people, "person_id");
  await write(client, "continuum_project_profiles", fixture.projects, "project_id");
  await write(client, "continuum_relationships", fixture.relationships, "id");
  await write(client, "continuum_project_lifecycle_states", fixture.lifecycle, "project_id,project_kind");
  await write(client, "continuum_project_jobs", fixture.jobs, "job_id");
  await write(client, "continuum_project_job_mutations", fixture.jobMutations, "mutation_id");
  await write(client, "continuum_evidence", fixture.evidence, "id");
  await write(client, "continuum_sterling_proposals", fixture.proposals, "proposal_id");
  await write(client, "continuum_conditional_holds", fixture.holds, "hold_id");
  await insertImmutableQuotes(client, fixture.quotes);
  await write(client, "continuum_repair_quote_mutations", fixture.quoteMutations, "mutation_id");
  return Object.fromEntries(Object.entries(fixture).map(([key, rows]) => [key, rows.length]));
}

async function main() {
  loadLocalPreviewEnv();
  assertPreviewFixtureTarget(process.env);
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const counts = await seedPreviewAcceptance(client);
  console.info(JSON.stringify({ target: "preview", projectRef: PREVIEW_REF, fixture: FIXTURE_MARKER, mode: process.argv.includes("--reset") ? "reset" : "seed", counts }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "preview-fixture-failed");
    process.exitCode = 1;
  });
}
