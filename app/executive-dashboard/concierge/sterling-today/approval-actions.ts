"use server";

import "server-only";

import { redirect } from "next/navigation";
import { getAuthenticatedCanonicalApprovalReviewAccess } from "@/lib/continuum/today-sterling/canonical-approval-load";

const REVIEW_PATH = "/executive-dashboard/concierge/sterling-today";

export async function reviewCanonicalSterlingProposal(formData: FormData): Promise<never> {
  const proposalId = String(formData.get("proposalId") ?? "").trim();
  const action = String(formData.get("reviewAction") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const expectedRecordVersion = Number(String(formData.get("expectedRecordVersion") ?? ""));
  if (!isUuid(proposalId) || !Number.isSafeInteger(expectedRecordVersion) || expectedRecordVersion < 1 ||
    (action !== "approve" && action !== "reject") || note.length > 1000) {
    redirectWithResult(proposalId, "invalid-request");
  }

  const access = await getAuthenticatedCanonicalApprovalReviewAccess();
  if (!access.ok) redirectWithResult(proposalId, access.reason);

  const current = await access.repository.get(proposalId);
  if (!current) redirectWithResult(proposalId, "proposal-not-found");

  if (current.status === "proposed") {
    const review = await access.reader.load(current);
    if (action === "approve" && !review.canApprove) redirectWithResult(proposalId, "review-blocked");
    if (action === "reject" && !review.canReject) redirectWithResult(proposalId, "invalid-transition");
  }

  const now = new Date().toISOString();
  const result = action === "approve"
    ? await access.repository.approveAndExecute({
        proposalId,
        expectedRecordVersion,
        decision: "approved",
        actor: access.username,
        note: note || null,
        now,
      })
    : await access.repository.reject({
        proposalId,
        expectedRecordVersion,
        actor: access.username,
        note: note || null,
        now,
      });

  if (!result.ok) redirectWithResult(proposalId, safeResultCode(result.reason));
  redirectWithResult(proposalId, result.status);
}

function redirectWithResult(proposalId: string, result: string): never {
  const search = new URLSearchParams();
  if (isUuid(proposalId)) search.set("proposal", proposalId);
  search.set("result", result);
  redirect(`${REVIEW_PATH}?${search.toString()}`);
}

function safeResultCode(reason: string): string {
  if (reason.includes("stale") || reason.includes("version")) return "stale-version";
  if (reason.includes("idempotency-conflict") || reason.includes("conflict")) return "conflicting-replay";
  if (reason.includes("not-found")) return "proposal-not-found";
  if (reason.includes("transition")) return "invalid-transition";
  return "transaction-rejected";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
