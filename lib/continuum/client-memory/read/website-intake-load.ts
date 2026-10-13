import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { requireInternalClientMemorySession } from "./access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import {
  CLIENT_WEBSITE_INTAKE_RECENT_LIMIT,
  type ClientWebsiteIntake,
  type ClientWebsiteIntakeReader,
} from "./website-intake";

const WEBSITE_INTAKE_COLUMNS = [
  "intake_id",
  "job_id",
  "status",
  "identity_status",
  "person_id",
  "full_name",
  "email",
  "phone",
  "preferred_contact_method",
  "category",
  "project_type",
  "shape_interest",
  "design_direction",
  "ring_presence",
  "timeline",
  "budget_range",
  "inspiration_notes",
  "attribution",
  "source",
  "submitted_at",
].join(", ");

function intakeRow(row: Record<string, unknown>): ClientWebsiteIntake | null {
  const intakeId = String(row.intake_id ?? "").trim();
  const fullName = String(row.full_name ?? "").trim();
  const email = String(row.email ?? "").trim();
  const submittedAt = String(row.submitted_at ?? "").trim();
  const status = row.status;
  const identityStatus = row.identity_status;
  const preferredContactMethod = row.preferred_contact_method;
  if (
    !intakeId ||
    !fullName ||
    !email ||
    !submittedAt ||
    (status !== "ready" && status !== "needs_review") ||
    (identityStatus !== "matched" &&
      identityStatus !== "new" &&
      identityStatus !== "needs_review") ||
    (preferredContactMethod !== "email" &&
      preferredContactMethod !== "phone" &&
      preferredContactMethod !== "text" &&
      preferredContactMethod !== "any")
  ) {
    return null;
  }
  const attribution =
    row.attribution && typeof row.attribution === "object" && !Array.isArray(row.attribution)
      ? (row.attribution as Record<string, unknown>)
      : {};
  return {
    intakeId,
    jobId: row.job_id == null ? null : String(row.job_id),
    status,
    identityStatus,
    personId: row.person_id == null ? null : String(row.person_id),
    fullName,
    email,
    phone: row.phone == null ? null : String(row.phone),
    preferredContactMethod,
    category: String(row.category ?? ""),
    projectType: String(row.project_type ?? ""),
    shapeInterest: String(row.shape_interest ?? ""),
    designDirection: String(row.design_direction ?? ""),
    ringPresence: String(row.ring_presence ?? ""),
    timeline: String(row.timeline ?? ""),
    budgetRange: String(row.budget_range ?? ""),
    inspirationNotes: String(row.inspiration_notes ?? ""),
    attribution,
    source: String(row.source ?? ""),
    submittedAt,
    correspondenceReview: null,
  };
}

async function readRows(query: PromiseLike<{ data: unknown; error: { message?: string } | null }>) {
  const { data, error } = await query;
  if (error) throw new Error(error.message ?? "read-website-intakes-failed");
  return Array.isArray(data)
    ? data.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const mapped = intakeRow(row as Record<string, unknown>);
        return mapped ? [mapped] : [];
      })
    : [];
}

class SupabaseClientWebsiteIntakeReader implements ClientWebsiteIntakeReader {
  constructor(private readonly client: SupabaseClient) {}

  private async withCorrespondenceReview(
    intakes: ClientWebsiteIntake[],
  ): Promise<ClientWebsiteIntake[]> {
    const hashes = new Set(
      intakes.flatMap((intake) => {
        const value = hashEmail(intake.email);
        return value ? [value] : [];
      }),
    );
    if (hashes.size === 0) return intakes;
    const { data, error } = await this.client
      .from("continuum_candidates")
      .select(
        "candidate_id, source_system, source_timestamp, candidate_type, payload, proposed_target, founder_edited_target, confidence, review_status, candidate_state",
      )
      .eq("source_system", "gmail")
      .eq("candidate_type", "person_association")
      .in("review_status", ["pending", "approved"])
      .or([...hashes].map((value) => `payload->>emailHash.eq.${value}`).join(","))
      .order("source_timestamp", { ascending: false })
      .limit(Math.max(25, hashes.size * 4));
    if (error || !Array.isArray(data)) return intakes;
    const byHash = new Map<string, ClientWebsiteIntake["correspondenceReview"]>();
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      if (row.candidate_state === "superseded") continue;
      const payload = row.payload && typeof row.payload === "object"
        ? row.payload as Record<string, unknown>
        : null;
      const emailHash = payload?.kind === "person_association"
        ? String(payload.emailHash ?? "").trim()
        : "";
      if (!emailHash || !hashes.has(emailHash) || byHash.has(emailHash)) continue;
      const status = row.review_status === "approved" ? "approved" : "pending";
      const confidence = ["low", "medium", "high", "ambiguous"].includes(String(row.confidence))
        ? row.confidence as "low" | "medium" | "high" | "ambiguous"
        : "ambiguous";
      byHash.set(emailHash, {
        candidateId: String(row.candidate_id ?? ""),
        status,
        confidence,
        sourceTimestamp: String(row.source_timestamp ?? ""),
      });
    }
    return intakes.map((intake) => ({
      ...intake,
      correspondenceReview: byHash.get(hashEmail(intake.email) ?? "") ?? null,
    }));
  }

  async listRecent(options?: { limit?: number }): Promise<ClientWebsiteIntake[]> {
    const limit = Math.min(
      Math.max(options?.limit ?? CLIENT_WEBSITE_INTAKE_RECENT_LIMIT, 1),
      CLIENT_WEBSITE_INTAKE_RECENT_LIMIT,
    );
    const rows = await readRows(
      this.client
        .from("continuum_website_intakes")
        .select(WEBSITE_INTAKE_COLUMNS)
        .eq("synthetic", false)
        .order("submitted_at", { ascending: false })
        .limit(limit),
    );
    return this.withCorrespondenceReview(rows);
  }

  async listActiveRecent(options?: { limit?: number }): Promise<ClientWebsiteIntake[]> {
    const intakes = await this.listRecent(options);
    const jobIds = intakes.flatMap((intake) => (intake.jobId ? [intake.jobId] : []));
    if (jobIds.length === 0) return [];
    const { data, error } = await this.client
      .from("continuum_project_jobs")
      .select("job_id, state")
      .in("job_id", jobIds);
    if (error) throw new Error(error.message ?? "read-website-intake-jobs-failed");
    const activeJobIds = new Set(
      (Array.isArray(data) ? data : []).flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const job = row as Record<string, unknown>;
        return (job.state === "open" || job.state === "snoozed") && job.job_id
          ? [String(job.job_id)]
          : [];
      }),
    );
    return intakes.filter((intake) => intake.jobId && activeJobIds.has(intake.jobId));
  }

  async listForPerson(personId: string): Promise<ClientWebsiteIntake[]> {
    const trimmed = personId.trim();
    if (!trimmed) return [];
    return readRows(
      this.client
        .from("continuum_website_intakes")
        .select(WEBSITE_INTAKE_COLUMNS)
        .eq("synthetic", false)
        .eq("person_id", trimmed)
        .order("submitted_at", { ascending: false }),
    );
  }
}

export type AuthenticatedClientWebsiteIntakeReader =
  | { ok: true; reader: ClientWebsiteIntakeReader }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function getAuthenticatedClientWebsiteIntakeReader(): Promise<AuthenticatedClientWebsiteIntakeReader> {
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) return { ok: false, reason: "unauthorized" };
  try {
    const client = getSupabaseAdmin();
    if (!client) return { ok: false, reason: "unavailable" };
    return { ok: true, reader: new SupabaseClientWebsiteIntakeReader(client) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function loadActiveClientWebsiteIntakes(): Promise<ClientWebsiteIntake[]> {
  const access = await getAuthenticatedClientWebsiteIntakeReader();
  if (!access.ok) return [];
  return access.reader.listActiveRecent({ limit: 25 }).catch(() => []);
}
