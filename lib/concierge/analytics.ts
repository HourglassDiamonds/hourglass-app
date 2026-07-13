import { event as gtagEvent } from "@/lib/gtag";
import type { AttributionSnapshot } from "@/lib/attribution";

/** Non-PII Concierge analytics helpers. */

export function trackConciergeFormStarted(): void {
  try {
    gtagEvent("concierge_form_started", {
      page_path:
        typeof window !== "undefined" ? window.location.pathname : "/concierge",
    });
  } catch {
    /* provider missing or blocked */
  }
}

export function trackConciergeFormError(reason: string): void {
  try {
    gtagEvent("concierge_form_error", {
      reason: reason.slice(0, 80),
      page_path:
        typeof window !== "undefined" ? window.location.pathname : "/concierge",
    });
  } catch {
    /* provider missing or blocked */
  }
}

export function trackConciergeFormSubmitted(params: {
  project_type?: string;
  budget_band?: string;
  timeline?: string;
  source?: string;
  originating_tool?: string;
  campaign?: string;
}): void {
  try {
    const safe: Record<string, string> = {};
    if (params.project_type) safe.project_type = params.project_type.slice(0, 80);
    if (params.budget_band) safe.budget_band = params.budget_band.slice(0, 40);
    if (params.timeline) safe.timeline = params.timeline.slice(0, 40);
    if (params.source) safe.source = params.source.slice(0, 120);
    if (params.originating_tool) {
      safe.originating_tool = params.originating_tool.slice(0, 80);
    }
    if (params.campaign) safe.campaign = params.campaign.slice(0, 80);

    gtagEvent("concierge_form_submitted", safe);
  } catch {
    /* provider missing or blocked */
  }
}

/** GA4 recommended conversion event — no PII. */
export function trackGenerateLead(params: {
  project_type?: string;
  budget_band?: string;
  timeline?: string;
  source?: string;
  originating_tool?: string;
  campaign?: string;
}): void {
  try {
    const safe: Record<string, string> = {};
    if (params.project_type) safe.project_type = params.project_type.slice(0, 80);
    if (params.budget_band) safe.budget_band = params.budget_band.slice(0, 40);
    if (params.timeline) safe.timeline = params.timeline.slice(0, 40);
    if (params.source) safe.source = params.source.slice(0, 120);
    if (params.originating_tool) {
      safe.originating_tool = params.originating_tool.slice(0, 80);
    }
    if (params.campaign) safe.campaign_name = params.campaign.slice(0, 80);

    gtagEvent("generate_lead", safe);
  } catch {
    /* provider missing or blocked */
  }
}

export function leadEventParamsFromForm(input: {
  projectType: string;
  budget: string;
  timeline: string;
  attribution: AttributionSnapshot;
  source: string;
}): {
  project_type?: string;
  budget_band?: string;
  timeline?: string;
  source?: string;
  originating_tool?: string;
  campaign?: string;
} {
  return {
    project_type: input.projectType || undefined,
    budget_band: input.budget || undefined,
    timeline: input.timeline || undefined,
    source: input.source || undefined,
    originating_tool: input.attribution.originating_tool,
    campaign: input.attribution.utm_campaign,
  };
}
