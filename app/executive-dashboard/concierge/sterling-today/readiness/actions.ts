"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { refreshTodayAfterFounderMutation } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import {
  INITIAL_MANUAL_PREVIEW_CHUNK_RESULT,
  type ManualPreviewChunkResult,
} from "@/lib/continuum/gmail/manual-preview-chunk";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { getAuthenticatedSterlingReadiness } from "@/lib/continuum/today-sterling/readiness";
import { isVerifiedSterlingTodayPreviewRuntime } from "@/lib/continuum/today-sterling/server-config";
import { runOnePreviewGmailIngestionChunk } from "../../gmail-incremental-actions";
import {
  createManualPreviewCorrelationId,
  logManualPreviewDiagnostic,
  manualPreviewStageForCode,
} from "@/lib/continuum/gmail/manual-preview-diagnostics";

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
  const correlationId = createManualPreviewCorrelationId();
  logManualPreviewDiagnostic({
    correlationId,
    stage: "preflight",
    outcome: "started",
    code: null,
  });

  let access: FounderPreviewAccess;
  try {
    access = await requireFounderPreviewAccess();
  } catch {
    logManualPreviewDiagnostic({
      correlationId,
      stage: "preflight",
      outcome: "failed",
      code: "unavailable",
    });
    redirect(
      `${PATH}?gmail=failed&code=unavailable&stage=preflight&correlation=${correlationId}`,
    );
  }
  if (!access.ok) {
    logManualPreviewDiagnostic({
      correlationId,
      stage: "preflight",
      outcome: "blocked",
      code: access.reason,
    });
    redirect(
      `${PATH}?gmail=blocked&code=${access.reason}&stage=preflight&correlation=${correlationId}`,
    );
  }
  logManualPreviewDiagnostic({
    correlationId,
    stage: "preflight",
    outcome: "succeeded",
    code: "ok",
  });

  let result: ManualPreviewChunkResult;
  try {
    result = await runOnePreviewGmailIngestionChunk(
      INITIAL_MANUAL_PREVIEW_CHUNK_RESULT,
      new FormData(),
      correlationId,
    );
  } catch {
    logManualPreviewDiagnostic({
      correlationId,
      stage: "preflight",
      outcome: "failed",
      code: "unexpected",
    });
    redirect(
      `${PATH}?gmail=failed&code=unexpected&stage=preflight&correlation=${correlationId}`,
    );
  }
  const code = result.safeErrorCode ?? result.blockedReason;
  const stage = manualPreviewStageForCode(code);
  logManualPreviewDiagnostic({
    correlationId,
    stage,
    outcome:
      result.status === "blocked"
        ? "blocked"
        : result.status === "failed"
          ? "failed"
          : "succeeded",
    code: code ?? "ok",
  });
  const params = new URLSearchParams({
    gmail: result.status,
    indexed: String(result.indexedThisChunk),
    remaining: result.morePagesRemain ? "yes" : "no",
    stage,
    correlation: correlationId,
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
