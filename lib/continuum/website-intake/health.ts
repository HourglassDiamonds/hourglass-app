import "server-only";

import { ingestWebsiteInquiryServer } from "./server";
import { classifyWebsiteInquiry, validateWebsiteInquiryFormData } from "./validation";

export async function runWebsiteIntakeHealthCheck() {
  const form = new FormData();
  const submissionId = crypto.randomUUID();
  form.set("submissionId", submissionId);
  form.set("fullName", "Continuum Intake Health Check");
  form.set("email", `continuum-health+${submissionId}@healthcheck.invalid`);
  form.set("phone", "");
  form.set("preferredContactMethod", "email");
  form.set("projectType", "Still Exploring");
  form.set("shapeInterest", "Not Sure Yet");
  form.set("designDirection", "Still Discovering");
  form.set("ringPresence", "Still Exploring");
  form.set("timeline", "Flexible");
  form.set("budgetRange", "Prefer to Discuss");
  form.set("inspirationNotes", "Synthetic Continuum intake health check.");

  const parsed = validateWebsiteInquiryFormData(form);
  if (!parsed.ok) return { ok: false as const, reason: "validation_failed" as const };
  const attribution = {};
  const result = await ingestWebsiteInquiryServer({
    ...parsed.value,
    category: classifyWebsiteInquiry(parsed.value.projectType),
    attribution,
    source: "hourglassdiamonds.com/concierge",
    acknowledgementExpected: false,
    synthetic: true,
  });
  if (!result.ok) return result;
  if (result.identityStatus !== "synthetic" || result.personId || result.jobId) {
    return { ok: false as const, reason: "isolation_failed" as const };
  }
  return result;
}
