import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePersonalState } from "./state";
import type { NaturalIngestionProposal, PerformanceSourceType, PersonalState, SterlingProposal } from "./types";
import { validatePersonalState } from "./validation";
import { detectedImageType } from "./image-upload";

export const PERFORMANCE_SOURCE_BUCKET = "continuum-performance-sources";
const STATE_TABLE = "continuum_performance_state";
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const SOURCE_RETENTION_DAYS = 90;
const MUTATION_ACTIONS = new Set(["bootstrap", "snapshot", "accept_meal", "accept_activity", "accept_recovery", "accept_adjustment", "configure_strength_program", "plan_strength_session", "activate_program", "transition_strength_program", "edit_meal", "edit_activity", "reject_proposal", "delete_source"]);

export type PerformanceMutation = { idempotencyKey: string; action: "bootstrap" | "snapshot" | "accept_meal" | "accept_activity" | "accept_recovery" | "accept_adjustment" | "configure_strength_program" | "plan_strength_session" | "activate_program" | "transition_strength_program" | "edit_meal" | "edit_activity" | "reject_proposal" | "delete_source"; entryId?: string; rawInput?: string; sourceType?: PerformanceSourceType; proposal?: NaturalIngestionProposal | SterlingProposal; accepted?: unknown; corrections?: unknown[]; sourceStoragePath?: string };
export type SavePerformanceStateInput = { founderKey: string; expectedRevision: number; state: PersonalState; mutation: PerformanceMutation; sourceFile?: File; now?: string };
export type SavedPerformanceState = { state: PersonalState; revision: number; duplicate: boolean };

export class PerformanceRevisionConflict extends Error {
  constructor(public readonly current: { state: PersonalState; revision: number } | null) { super("performance-revision-conflict"); }
}

function founderPath(founderKey: string): string { return createHash("sha256").update(founderKey).digest("hex").slice(0, 20); }
function safeExtension(file: File): string { return file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg"; }
function addDays(iso: string, days: number): string { const value = new Date(iso); value.setUTCDate(value.getUTCDate() + days); return value.toISOString(); }
function attachStoragePath(state: PersonalState, entryId: string | undefined, storagePath: string | undefined, idempotencyKey?: string): PersonalState {
  if (!entryId || !storagePath) return state;
  return {
    ...state,
    meals: state.meals.map((meal) => meal.id === entryId && meal.photo ? { ...meal, photo: { ...meal.photo, storagePath } } : meal),
    activities: state.activities.map((activity) => (activity.id === entryId || activity.idempotencyKey === idempotencyKey) && activity.source ? { ...activity, source: { ...activity.source, storagePath } } : activity),
    recoveryEntries: state.recoveryEntries.map((entry) => entry.id === entryId && entry.source ? { ...entry, source: { ...entry.source, storagePath } } : entry),
    tonal: { ...state.tonal, enrollment: { ...state.tonal.enrollment, sources: state.tonal.enrollment.sources.map((source) => source.digest && entryId.includes(source.digest.slice(0, 32)) && source.file ? { ...source, file: { ...source.file, storagePath } } : source), sessions: state.tonal.enrollment.sessions.map((session) => session.plannedSource?.digest && entryId.includes(session.plannedSource.digest.slice(0, 32)) && session.plannedSource.file ? { ...session, plannedSource: { ...session.plannedSource, file: { ...session.plannedSource.file, storagePath } } } : session) } },
  };
}
function evidenceHash(mutation: PerformanceMutation): string {
  return createHash("sha256").update(JSON.stringify({ rawInput: mutation.rawInput ?? null, proposal: mutation.proposal ?? null, accepted: mutation.accepted ?? null, corrections: mutation.corrections ?? [] })).digest("hex");
}

export async function loadPerformanceStateWithClient(founderKey: string, today: string, db: SupabaseClient): Promise<{ state: PersonalState; revision: number } | null> {
  const { data, error } = await db.from(STATE_TABLE).select("state, revision").eq("founder_key", founderKey).maybeSingle();
  if (error) throw new Error(`performance-load-failed:${error.message}`);
  if (!data) return null;
  return { state: parsePersonalState(JSON.stringify((data as { state: unknown }).state), today), revision: Number((data as { revision: unknown }).revision) || 1 };
}

export async function savePerformanceStateWithClient(input: SavePerformanceStateInput, db: SupabaseClient): Promise<SavedPerformanceState> {
  const now = input.now ?? new Date().toISOString();
  if (!input.founderKey.trim() || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || !MUTATION_ACTIONS.has(input.mutation.action)) throw new Error("performance-mutation-invalid");
  if (input.sourceFile && (!input.mutation.entryId || !["accept_meal", "accept_activity", "accept_recovery", "configure_strength_program", "plan_strength_session", "edit_activity"].includes(input.mutation.action))) throw new Error("performance-source-ownership-invalid");
  let storagePath: string | undefined; let uploaded = false;
  if (input.sourceFile) {
    if (input.sourceFile.size <= 0 || input.sourceFile.size > MAX_SOURCE_BYTES) throw new Error("performance-source-invalid");
    const sourceBytes = Buffer.from(await input.sourceFile.arrayBuffer());
    const sourceType = detectedImageType(sourceBytes);
    if (!sourceType || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(sourceType)) throw new Error("performance-source-invalid");
    if (input.mutation.action === "accept_activity") {
      const proposal = input.mutation.proposal;
      const actualDigest = createHash("sha256").update(sourceBytes).digest("hex");
      if (!proposal || !("kind" in proposal) || proposal.kind !== "activity" || proposal.normalizedSourceDigest !== actualDigest || !proposal.sourceDigest) {
        throw new Error("performance-source-digest-invalid");
      }
      if (input.mutation.idempotencyKey !== `accept-activity-${proposal.sourceDigest}` || input.mutation.entryId !== `activity-${proposal.sourceDigest.slice(0, 32)}`) {
        throw new Error("performance-source-dedupe-invalid");
      }
    }
    if (input.mutation.action === "accept_recovery") {
      const proposal = input.mutation.proposal;
      const actualDigest = createHash("sha256").update(sourceBytes).digest("hex");
      const entry = input.state.recoveryEntries.find((candidate) => candidate.id === input.mutation.entryId);
      if (!proposal || !("kind" in proposal) || proposal.kind !== "recovery" || proposal.sourceType !== "recovery_screenshot" || input.mutation.sourceType !== "recovery_screenshot" || proposal.normalizedSourceDigest !== actualDigest || !proposal.sourceDigest || !entry) {
        throw new Error("performance-source-digest-invalid");
      }
      if (input.mutation.idempotencyKey !== `accept-recovery-${proposal.sourceDigest}` || entry.idempotencyKey !== input.mutation.idempotencyKey) throw new Error("performance-source-dedupe-invalid");
    }
    if (input.mutation.action === "edit_activity") {
      const proposal = input.mutation.proposal;
      const actualDigest = createHash("sha256").update(sourceBytes).digest("hex");
      if (!proposal || !("kind" in proposal) || proposal.kind !== "activity" || proposal.normalizedSourceDigest !== actualDigest || !proposal.sourceDigest || input.mutation.idempotencyKey !== `enrich-activity-${input.mutation.entryId}-${proposal.sourceDigest}`) {
        throw new Error("performance-source-digest-invalid");
      }
    }
    if (input.mutation.action === "configure_strength_program") {
      const actualDigest = createHash("sha256").update(sourceBytes).digest("hex");
      const accepted = input.mutation.accepted as { sourceDigest?: unknown } | undefined;
      if (accepted?.sourceDigest !== actualDigest || input.mutation.idempotencyKey !== `configure-tonal-${actualDigest}` || input.mutation.entryId !== `tonal-program-${actualDigest.slice(0, 32)}`) {
        throw new Error("performance-source-digest-invalid");
      }
    }
    if (input.mutation.action === "plan_strength_session") {
      const actualDigest = createHash("sha256").update(sourceBytes).digest("hex");
      const accepted = input.mutation.accepted as { sourceDigest?: unknown; sequencePosition?: unknown } | undefined;
      const proposal = input.mutation.proposal;
      const order = Number(accepted?.sequencePosition);
      if (!proposal || !("normalizedSourceDigest" in proposal) || proposal.normalizedSourceDigest !== actualDigest || typeof accepted?.sourceDigest !== "string" || accepted.sourceDigest !== proposal.sourceDigest || !Number.isSafeInteger(order) || order < 1 || input.mutation.idempotencyKey !== `plan-tonal-${order}-${accepted.sourceDigest}` || input.mutation.entryId !== `tonal-plan-${order}-${accepted.sourceDigest.slice(0, 32)}`) {
        throw new Error("performance-source-digest-invalid");
      }
    }
    const storageKey = ["edit_activity", "accept_recovery"].includes(input.mutation.action) ? `${input.mutation.entryId}-${createHash("sha256").update(sourceBytes).digest("hex").slice(0, 16)}` : input.mutation.entryId;
    storagePath = `${founderPath(input.founderKey)}/${storageKey}.${safeExtension(input.sourceFile)}`;
    const { error } = await db.storage.from(PERFORMANCE_SOURCE_BUCKET).upload(storagePath, sourceBytes, { contentType: sourceType, upsert: false });
    if (error && !/already exists|duplicate/i.test(error.message)) throw new Error(`performance-source-upload-failed:${error.message}`);
    uploaded = !error;
  }
  const state = attachStoragePath(input.state, input.mutation.entryId, storagePath, input.mutation.idempotencyKey); const validation = validatePersonalState(state);
  if (validation.length) throw new Error(`performance-state-invalid:${validation.join(",")}`);
  try {
    const { data, error } = await db.rpc("continuum_performance_save", {
      p_founder_key: input.founderKey, p_expected_revision: input.expectedRevision, p_schema_version: 3, p_state: state,
      p_audit_id: randomUUID(), p_idempotency_key: input.mutation.idempotencyKey, p_action: input.mutation.action,
      p_entry_id: input.mutation.entryId ?? null, p_source_type: input.mutation.sourceType ?? null,
      p_evidence_hash: evidenceHash(input.mutation), p_raw_input: input.mutation.rawInput ?? null,
      p_proposal: input.mutation.proposal ?? null, p_accepted: input.mutation.accepted ?? null,
      p_corrections: input.mutation.corrections ?? [], p_source_storage_path: storagePath ?? input.mutation.sourceStoragePath ?? null,
      p_source_expires_at: storagePath ? addDays(now, SOURCE_RETENTION_DAYS) : null,
      p_sensitive_expires_at: addDays(now, SOURCE_RETENTION_DAYS), p_created_at: now,
    });
    if (error) {
      if (error.code === "40001" || /performance_revision_conflict/i.test(error.message)) throw new PerformanceRevisionConflict(await loadPerformanceStateWithClient(input.founderKey, now.slice(0, 10), db));
      if (error.code === "23514" && /continuum_performance_audit_action_check/i.test(error.message)) throw new Error("performance-mutation-action-unavailable");
      throw new Error(`performance-save-failed:${error.code || "unknown"}`);
    }
    const row = (Array.isArray(data) ? data[0] : data) as { saved_state?: unknown; saved_revision?: unknown; was_duplicate?: unknown } | null;
    if (!row) throw new Error("performance-save-failed:empty-result");
    return { state: parsePersonalState(JSON.stringify(row.saved_state), now.slice(0, 10)), revision: Number(row.saved_revision), duplicate: Boolean(row.was_duplicate) };
  } catch (error) {
    if (uploaded && storagePath) await db.storage.from(PERFORMANCE_SOURCE_BUCKET).remove([storagePath]).catch(() => undefined);
    throw error;
  }
}

export async function deletePerformanceSourceWithClient(input: { founderKey: string; expectedRevision: number; entryId: string; kind: "meal" | "activity" | "recovery"; idempotencyKey: string; now?: string }, db: SupabaseClient): Promise<SavedPerformanceState> {
  const loaded = await loadPerformanceStateWithClient(input.founderKey, (input.now ?? new Date().toISOString()).slice(0, 10), db);
  if (!loaded || loaded.revision !== input.expectedRevision) throw new PerformanceRevisionConflict(loaded);
  const entry = input.kind === "meal" ? loaded.state.meals.find((meal) => meal.id === input.entryId) : input.kind === "activity" ? loaded.state.activities.find((activity) => activity.id === input.entryId) : loaded.state.recoveryEntries.find((recovery) => recovery.id === input.entryId);
  const path = input.kind === "meal" ? (entry && "photo" in entry ? entry.photo?.storagePath : undefined) : (entry && "source" in entry ? entry.source?.storagePath : undefined);
  if (!path || !path.startsWith(`${founderPath(input.founderKey)}/`)) throw new Error("performance-source-not-found");
  const { error: removeError } = await db.storage.from(PERFORMANCE_SOURCE_BUCKET).remove([path]);
  if (removeError) throw new Error(`performance-source-delete-failed:${removeError.message}`);
  const state: PersonalState = input.kind === "meal"
    ? { ...loaded.state, meals: loaded.state.meals.map((meal) => meal.id === input.entryId && meal.photo ? { ...meal, photo: { name: meal.photo.name, type: meal.photo.type, size: meal.photo.size } } : meal) }
    : input.kind === "activity"
      ? { ...loaded.state, activities: loaded.state.activities.map((activity) => activity.source?.storagePath === path ? { ...activity, source: { name: activity.source.name, type: activity.source.type, size: activity.source.size } } : activity) }
      : { ...loaded.state, recoveryEntries: loaded.state.recoveryEntries.map((recovery) => recovery.source?.storagePath === path ? { ...recovery, source: { name: recovery.source.name, type: recovery.source.type, size: recovery.source.size } } : recovery) };
  return savePerformanceStateWithClient({ founderKey: input.founderKey, expectedRevision: input.expectedRevision, state, mutation: { idempotencyKey: input.idempotencyKey, action: "delete_source", entryId: input.entryId, sourceStoragePath: path }, now: input.now }, db);
}
