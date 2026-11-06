"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { refreshTodayAfterFounderMutation } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import {
  INITIAL_MANUAL_PREVIEW_CHUNK_RESULT,
} from "@/lib/continuum/gmail/manual-preview-chunk";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { getAuthenticatedSterlingReadiness } from "@/lib/continuum/today-sterling/readiness";
import { isVerifiedSterlingTodayPreviewRuntime } from "@/lib/continuum/today-sterling/server-config";
import { runOnePreviewGmailIngestionChunk } from "../../gmail-incremental-actions";

const PATH = "/executive-dashboard/concierge/sterling-today/readiness";
const TODAY_PATH = "/executive-dashboard/concierge";

type FounderPreviewAccess =
  | { ok: true }
  | { ok: false; reason: "not-preview" | "unauthorized" };

async function requireFounderPreviewAccess(): Promise<FounderPreviewAccess> {
  if (!isVerifiedSterlingTodayPreviewRuntime()) {
    return { ok: false, reason: "not-preview" };
  }
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  return session.ok
    ? { ok: true }
    : { ok: false, reason: "unauthorized" };
}

export async function runZeroWriteGmailReadinessCheck(
  _formData: FormData,
): Promise<void> {
  void _formData;
  const access = await requireFounderPreviewAccess();
  if (!access.ok) redirect(`${PATH}?readiness=${access.reason}`);

  const readiness = await getAuthenticatedSterlingReadiness();
  redirect(`${PATH}?readiness=${readiness.ok ? "completed" : readiness.reason}`);
}

export async function runOneControlledGmailRefreshChunk(
  _formData: FormData,
): Promise<void> {
  void _formData;
  const access = await requireFounderPreviewAccess();
  if (!access.ok) redirect(`${PATH}?gmail=${access.reason}`);

  const result = await runOnePreviewGmailIngestionChunk(
    INITIAL_MANUAL_PREVIEW_CHUNK_RESULT,
    new FormData(),
  );
  const code = result.safeErrorCode ?? result.blockedReason;
  const params = new URLSearchParams({
    gmail: result.status,
    indexed: String(result.indexedThisChunk),
    remaining: result.morePagesRemain ? "yes" : "no",
  });
  if (code) params.set("code", code);
  revalidatePath(PATH);
  redirect(`${PATH}?${params.toString()}`);
}

export async function recomputeCanonicalToday(_formData: FormData): Promise<void> {
  void _formData;
  const access = await requireFounderPreviewAccess();
  if (!access.ok) redirect(`${PATH}?recompute=${access.reason}`);

  let result = "completed";
  try {
    await refreshTodayAfterFounderMutation();
    revalidatePath(TODAY_PATH);
    revalidatePath(PATH);
  } catch {
    result = "failed";
  }

  redirect(`${PATH}?recompute=${result}`);
}
