import type { WebsiteIntakeResult } from "./types";

export type WebsiteIntakeHubSpotAction =
  | "deliver"
  | "skip_succeeded"
  | "recovery_required";

/**
 * A replay with an uncertain HubSpot state must not create another deal.
 * HubSpot delivery is retried only for a newly-created durable intake.
 */
export function decideWebsiteIntakeHubSpotAction(
  result: Extract<WebsiteIntakeResult, { ok: true }>,
): WebsiteIntakeHubSpotAction {
  if (result.hubspotStatus === "succeeded") return "skip_succeeded";
  if (result.status === "already-present") return "recovery_required";
  return "deliver";
}

export function websiteIntakeHubSpotCorrelationLine(intakeId: string): string {
  return `Continuum Intake ID: ${intakeId}`;
}
