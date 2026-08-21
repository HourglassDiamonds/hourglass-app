/**
 * Identified Studio event store.
 *
 * Not a CRM. Not Agent OS persistence (that store forbids customer PII).
 *
 * Development / tests: in-memory fallback is allowed and marked non-durable.
 * Preview / production: Supabase is required for a durable write. If the
 * write fails, the visitor email may still have sent — do not pretend the
 * identified history was retained.
 *
 * Full recipient email is retained here for legitimate later matching to a
 * Concierge identity by exact normalized email. Never copy this into GA.
 */

import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { StudioViewEmailedRecord } from "./types";

export const STUDIO_IDENTIFIED_EVENTS_TABLE =
  "diamond_studio_identified_events" as const;

export type StudioPersistResult =
  | {
      ok: true;
      adapter: "supabase";
      durable: true;
      status: "durable";
    }
  | {
      ok: true;
      adapter: "memory";
      durable: false;
      status: "memory";
    }
  | {
      ok: false;
      adapter: "supabase" | "none";
      durable: false;
      status: "failed";
      reason: "unavailable" | "write_failed";
    };

const memory: StudioViewEmailedRecord[] = [];

export function resetStudioIdentifiedEventStore(): void {
  memory.length = 0;
}

export function listStudioViewEmailedFromMemory(): StudioViewEmailedRecord[] {
  return [...memory];
}

/**
 * Preview and production must not silently treat memory as durable history.
 * Local development and unit tests may.
 */
export function memoryFallbackAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const vercelEnv = env.VERCEL_ENV?.trim();
  if (vercelEnv === "production" || vercelEnv === "preview") return false;
  if (env.NODE_ENV === "production") return false;
  return true;
}

export async function persistStudioViewEmailed(
  record: StudioViewEmailedRecord,
  options?: { env?: NodeJS.ProcessEnv },
): Promise<StudioPersistResult> {
  const env = options?.env ?? process.env;
  const allowMemory = memoryFallbackAllowed(env);
  const admin = getSupabaseAdmin();

  if (!admin) {
    if (allowMemory) {
      memory.push(record);
      return {
        ok: true,
        adapter: "memory",
        durable: false,
        status: "memory",
      };
    }
    console.error("[studio-view-emailed-persist]", {
      failed: true,
      durable: false,
      reason: "unavailable",
    });
    return {
      ok: false,
      adapter: "none",
      durable: false,
      status: "failed",
      reason: "unavailable",
    };
  }

  const { error } = await admin.from(STUDIO_IDENTIFIED_EVENTS_TABLE).insert({
    id: record.id,
    created_at: record.timestamp,
    event: record.event,
    status: record.status,
    recipient_email: record.recipientEmail,
    email_normalized: record.emailNormalized,
    email_hash: record.emailHash,
    first_name: record.firstName ?? null,
    configuration: record.configuration,
    studio_share_path: record.studioSharePath,
    attribution: record.attribution ?? null,
    marketing_consent: record.marketingConsent,
    inquiry_created: record.inquiryCreated,
  });

  if (error) {
    console.error("[studio-view-emailed-persist]", {
      adapter: "supabase",
      failed: true,
      durable: false,
      reason: "write_failed",
    });
    if (allowMemory) {
      memory.push(record);
      return {
        ok: true,
        adapter: "memory",
        durable: false,
        status: "memory",
      };
    }
    return {
      ok: false,
      adapter: "supabase",
      durable: false,
      status: "failed",
      reason: "write_failed",
    };
  }

  return {
    ok: true,
    adapter: "supabase",
    durable: true,
    status: "durable",
  };
}

export async function listStudioViewEmailedByNormalizedEmail(
  emailNormalized: string,
): Promise<StudioViewEmailedRecord[]> {
  const key = emailNormalized.trim().toLowerCase();
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data, error } = await admin
      .from(STUDIO_IDENTIFIED_EVENTS_TABLE)
      .select("*")
      .eq("email_normalized", key)
      .order("created_at", { ascending: true });
    if (!error && Array.isArray(data)) {
      return data.map(rowToRecord);
    }
  }
  return memory.filter((row) => row.emailNormalized === key);
}

export async function getStudioViewEmailedById(
  id: string,
): Promise<StudioViewEmailedRecord | null> {
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data, error } = await admin
      .from(STUDIO_IDENTIFIED_EVENTS_TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!error && data) return rowToRecord(data as Record<string, unknown>);
  }
  return memory.find((row) => row.id === id) ?? null;
}

export async function deleteStudioViewEmailedById(id: string): Promise<boolean> {
  const before = memory.length;
  for (let i = memory.length - 1; i >= 0; i -= 1) {
    if (memory[i]?.id === id) memory.splice(i, 1);
  }
  const admin = getSupabaseAdmin();
  if (!admin) return memory.length < before;
  const { error } = await admin
    .from(STUDIO_IDENTIFIED_EVENTS_TABLE)
    .delete()
    .eq("id", id);
  return !error || memory.length < before;
}

function rowToRecord(row: Record<string, unknown>): StudioViewEmailedRecord {
  return {
    event: "studio_view_emailed",
    id: String(row.id),
    timestamp: String(row.created_at ?? row.timestamp),
    recipientEmail: String(row.recipient_email),
    emailNormalized: String(row.email_normalized),
    emailHash: String(row.email_hash),
    firstName: row.first_name ? String(row.first_name) : undefined,
    configuration: row.configuration as StudioViewEmailedRecord["configuration"],
    studioSharePath: String(row.studio_share_path),
    attribution:
      (row.attribution as StudioViewEmailedRecord["attribution"]) ?? undefined,
    status: "sent",
    marketingConsent: false,
    inquiryCreated: false,
  };
}
