/** READ-ONLY, sanitized Production audit for the October 30 founder acceptance set. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF } from "../lib/continuum/runtime-env";

const TERMS = [
  "daniel iles", "melissa ribeiro", "reception ballantyne", "madi rutledge", "christie jean jones",
  "audrey", "morgan", "ty sheffield", "james", "sarah", "zane", "nate", "nathan", "abbey",
  "jp", "dylan", "dylon", "grant", "tim", "jenn", "pennock", "duane", "justin ckezepis", "southpark",
] as const;

const CANDIDATE_DISPLAY_NAMES = new Set([
  "daniel iles", "melissa ribeiro", "reception ballantyne", "madi rutledge", "christie jean jones",
  "audrey", "morgan", "ty sheffield", "james", "sarah", "zane", "nate p.", "nate p", "nathan",
  "abbey", "jp", "dylan", "dylon", "f. grant", "tim", "jenn", "j. pennock", "duane",
  "justin ckezepis", "southpark editor",
]);

function loadEnvFile(path: string) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const text = line.trim();
      if (!text || text.startsWith("#")) continue;
      const index = text.indexOf("=");
      if (index < 1) continue;
      const key = text.slice(0, index).trim();
      let value = text.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
      if (key.endsWith("_SUPABASE_URL") && !process.env.SUPABASE_URL) process.env.SUPABASE_URL = value;
    }
  } catch {
    // Optional local environment file.
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (!value) throw new Error(`missing-${name}`);
  return value;
}

function matches(value: unknown): boolean {
  const text = JSON.stringify(value).toLowerCase();
  return TERMS.some((term) => text.includes(term));
}

function matchesCandidate(row: Record<string, unknown>): boolean {
  const payload = row.payload as Record<string, unknown> | null;
  const displayName = typeof payload?.displayName === "string" ? payload.displayName.trim().toLowerCase() : "";
  if (CANDIDATE_DISPLAY_NAMES.has(displayName)) return true;
  const text = JSON.stringify(row).toLowerCase();
  return [
    "daniel iles", "melissa ribeiro", "reception ballantyne", "madi rutledge", "christie jean jones",
    "ty sheffield", "j. pennock", "justin ckezepis", "southpark",
  ].some((term) => text.includes(term));
}

function opaque(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? createHash("sha256").update(text).digest("hex").slice(0, 16) : null;
}

async function pages(client: SupabaseClient, table: string, columns: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}:${error.message}`);
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    if ((data ?? []).length < 1000) return rows;
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve("C:/Users/justi/OneDrive/Desktop/hourglass-app/.env.local"));
  const url = required("SUPABASE_URL");
  if (!url.includes(CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF)) throw new Error("refusing-non-production-audit-target");
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || required("SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [people, projects, relationships, lifecycle, history, jobs, candidates] = await Promise.all([
    pages(client, "continuum_person_profiles", "person_id, display_name, roles, organization_name"),
    pages(client, "continuum_project_profiles", "project_id, display_title, project_kind"),
    pages(client, "continuum_relationships", "from_entity_id, to_entity_id, kind, status"),
    pages(client, "continuum_project_lifecycle_states", "project_id, stage, updated_at"),
    pages(client, "continuum_project_history", "project_id, cad_job_number, order_number, gmail_thread_id, updated_at"),
    pages(client, "continuum_project_jobs", "job_id, project_id, associated_person_id, subject, state, waiting_on_actor, attention_mode, updated_at, source_ref"),
    pages(client, "continuum_candidates", "candidate_id, source_ref, source_timestamp, candidate_type, proposed_target, payload, candidate_state, review_status, founder_edited_target"),
  ]);
  const matchedPeople = people.filter(matches);
  const matchedPersonIds = new Set(matchedPeople.map((row) => String(row.person_id)));
  const matchedProjectIds = new Set(projects.filter(matches).map((row) => String(row.project_id)));
  for (const row of relationships) {
    if (matchedPersonIds.has(String(row.from_entity_id))) matchedProjectIds.add(String(row.to_entity_id));
  }
  const matchedProjects = projects.filter((row) => matchedProjectIds.has(String(row.project_id)));
  const relatedPersonIds = new Set(matchedPersonIds);
  for (const row of relationships) {
    if (matchedProjectIds.has(String(row.to_entity_id))) relatedPersonIds.add(String(row.from_entity_id));
  }
  const candidateMatches = candidates.filter(matchesCandidate).map((row) => ({
    candidateId: opaque(row.candidate_id),
    sourceRef: opaque(row.source_ref),
    sourceTimestamp: row.source_timestamp,
    candidateType: row.candidate_type,
    candidateState: row.candidate_state,
    reviewStatus: row.review_status,
    targetKind: (row.proposed_target as Record<string, unknown> | null)?.kind ?? null,
    founderDisposition: (row.founder_edited_target as Record<string, unknown> | null)?.founderDisposition ?? null,
    payloadKind: (row.payload as Record<string, unknown> | null)?.kind ?? null,
    displayName: (row.payload as Record<string, unknown> | null)?.displayName ?? null,
  }));
  process.stdout.write(`${JSON.stringify({
    productionReadOnly: true,
    people: people.filter((row) => relatedPersonIds.has(String(row.person_id))),
    projects: matchedProjects,
    relationships: relationships.filter((row) => matchedPersonIds.has(String(row.from_entity_id)) || matchedProjectIds.has(String(row.to_entity_id))),
    lifecycle: lifecycle.filter((row) => matchedProjectIds.has(String(row.project_id))),
    history: history.filter((row) => matchedProjectIds.has(String(row.project_id))).map((row) => ({ ...row, gmail_thread_id: opaque(row.gmail_thread_id) })),
    jobs: jobs.filter((row) => matchedProjectIds.has(String(row.project_id)) || matchedPersonIds.has(String(row.associated_person_id)))
      .map((row) => ({ ...row, source_ref: opaque(row.source_ref) })),
    candidateMatchCount: candidateMatches.length,
    candidates: candidateMatches.slice(0, 100),
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
