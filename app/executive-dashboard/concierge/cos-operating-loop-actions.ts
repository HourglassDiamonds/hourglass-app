"use server";

import { refreshTodayAfterFounderMutation } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { operatingBacklogRecommendationId } from "@/lib/agent-os/operating-backlog";
import { markRecommendationTerminal } from "@/lib/agent-os/persistence/mark-terminal";
import { resolvePersistenceAdapter } from "@/lib/agent-os/persistence/resolve";
import { getAuthenticatedProjectJobWriter } from "@/lib/continuum/client-memory/project-jobs/load-writer";
import { getAuthenticatedClientMemoryProjectSpecWriter } from "@/lib/continuum/client-memory/project-spec/load";
import { getAuthenticatedCandidateStore } from "@/lib/continuum/candidates/load";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import { completeFounderActionable } from "@/lib/continuum/chief-of-staff/operating-loop/complete";
import { disposeDocketItem } from "@/lib/continuum/chief-of-staff/operating-loop/disposition";
import { logFounderMutation } from "@/lib/continuum/founder-mutation-log";
import {
  isFounderVerb,
  isSnoozePreset,
  snoozeUntilForPreset,
} from "@/lib/continuum/chief-of-staff/operating-loop/founder-actions";
import type { CosDocketOrigin } from "@/lib/continuum/chief-of-staff/operating-loop/types";

function humanMessage(
  reason: string | undefined,
  unauthorized: boolean,
): string {
  if (unauthorized) return "Sign in to continue.";
  if (reason === "unsupported-writer" || reason === "unsupported-mutation") {
    return "This item cannot be completed from here.";
  }
  if (reason === "invalid-state") {
    return "That change is not available for this job.";
  }
  if (reason === "job-not-found" || reason === "project-not-found") {
    return "That open job could not be found.";
  }
  if (reason === "candidate-not-found") {
    return "That recommendation could not be found.";
  }
  return "Unable to complete this item.";
}

function isDocketOrigin(value: string): value is CosDocketOrigin {
  return (
    value === "brief" ||
    value === "open_job" ||
    value === "decision" ||
    value === "anomaly" ||
    value === "signal" ||
    value === "master_sprint"
  );
}

export async function completeTop5OpenJobAction(formData: FormData) {
  const started = Date.now();
  try {
    const auth = await getAuthenticatedProjectJobWriter();
    if (!auth.ok) {
      const message = humanMessage(undefined, auth.reason === "unauthorized");
      logFounderMutation({ verb: "complete", origin: "open_job", ok: false, reason: auth.reason, ms: Date.now() - started });
      return { ok: false, message } satisfies TodayMutationResult;
    }
    const result = await completeFounderActionable(auth.writer, {
      sourceType: String(formData.get("sourceType") ?? "").trim(),
      projectId: String(formData.get("projectId") ?? "").trim() || null,
      jobId: String(formData.get("jobId") ?? "").trim(),
      mutationId: String(formData.get("mutationId") ?? "").trim(),
      actor: auth.username,
    });
    logFounderMutation({
      verb: "complete",
      origin: "open_job",
      ok: result.ok,
      reason: result.ok ? undefined : result.reason,
      ms: Date.now() - started,
    });
    if (!result.ok) {
      return { ok: false, message: humanMessage(result.reason, false) } satisfies TodayMutationResult;
    }
    await settleTodayAfterMutation();
    return { ok: true } satisfies TodayMutationResult;
  } catch {
    logFounderMutation({ verb: "complete", origin: "open_job", ok: false, reason: "unexpected", ms: Date.now() - started });
    return { ok: false, message: "Unable to complete this item. Try again." } satisfies TodayMutationResult;
  }
}

export type TodayMutationResult =
  | { ok: true }
  | { ok: false; message: string };

async function settleTodayAfterMutation(): Promise<void> {
  try {
    await refreshTodayAfterFounderMutation();
  } catch {
    // The canonical write already succeeded. Do not report a false mutation
    // failure when only read-model reconstruction needs another pass.
  }
  try {
    revalidatePath(CONCIERGE_HOME_PATH);
  } catch {
    // The optimistic tombstone remains until the next targeted route render.
  }
}

export async function disposeTodayDocketItemAction(formData: FormData): Promise<TodayMutationResult> {
  const started = Date.now();
  try {
  const verbRaw = String(formData.get("verb") ?? "").trim();
  const originRaw = String(formData.get("origin") ?? "").trim();
  if (!isFounderVerb(verbRaw) || !isDocketOrigin(originRaw)) {
    logFounderMutation({
      verb: verbRaw || "unknown",
      origin: originRaw || "unknown",
      ok: false,
      reason: "invalid-input",
      ms: Date.now() - started,
    });
    return { ok: false, message: "That action is not available for this item." };
  }
  const presetRaw = String(formData.get("snoozePreset") ?? "").trim();
  const chosenDate = String(formData.get("snoozeDate") ?? "").trim();
  const nowIso = new Date().toISOString();
  const snoozeUntil = isSnoozePreset(presetRaw)
    ? snoozeUntilForPreset(presetRaw, nowIso, chosenDate)
    : String(formData.get("snoozeUntil") ?? "").trim() || null;

  const jobs = await getAuthenticatedProjectJobWriter();
  if (!jobs.ok) {
    const message = humanMessage(undefined, jobs.reason === "unauthorized");
    logFounderMutation({ verb: verbRaw, origin: originRaw, ok: false, reason: jobs.reason, ms: Date.now() - started });
    return { ok: false, message };
  }
  const candidates = await getAuthenticatedCandidateStore();
  const specs = await getAuthenticatedClientMemoryProjectSpecWriter();
  const result = await disposeDocketItem(
    {
      nowIso: () => nowIso,
      candidates: candidates.ok ? candidates.store : null,
      jobs: jobs.writer,
      correctProjectSpec: specs.ok
        ? (input) => specs.writer.correctProjectSpec(input)
        : undefined,
      markSprintTerminal: async ({ itemId, status }) => {
        try {
          const resolved = resolvePersistenceAdapter({ mode: "live" });
          if (!resolved.store.liveEligible || !resolved.store.isDurable) {
            return { ok: false, reason: "unavailable" };
          }
          await markRecommendationTerminal(resolved.store, {
            recommendationId: operatingBacklogRecommendationId(itemId),
            status,
            source: "founder-confirmed",
          });
          return { ok: true };
        } catch {
          return { ok: false, reason: "unavailable" };
        }
      },
    },
    {
      verb: verbRaw,
      origin: originRaw,
      itemId: String(formData.get("itemId") ?? "").trim(),
      projectId: String(formData.get("projectId") ?? "").trim() || null,
      jobId: String(formData.get("jobId") ?? "").trim() || null,
      candidateIds: String(formData.get("candidateIds") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
      specFieldName: String(formData.get("specFieldName") ?? "").trim() || null,
      specProposedValue: String(formData.get("specProposedValue") ?? "").trim() || null,
      specCanonicalValue: String(formData.get("specCanonicalValue") ?? "").trim() || null,
      mutationId: String(formData.get("mutationId") ?? "").trim() || randomUUID(),
      actor: jobs.username,
      snoozeUntil,
    },
  );
  logFounderMutation({
    verb: verbRaw,
    origin: originRaw,
    ok: result.ok,
    reason: result.ok ? undefined : result.reason,
    ms: Date.now() - started,
  });
  if (!result.ok) {
    return { ok: false, message: humanMessage(result.reason, false) };
  }
  await settleTodayAfterMutation();
  return { ok: true };
  } catch {
    logFounderMutation({ verb: "unknown", origin: "unknown", ok: false, reason: "unexpected", ms: Date.now() - started });
    return { ok: false, message: "Unable to save that change. Try again." };
  }
}
