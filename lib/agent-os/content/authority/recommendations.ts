/**
 * Bounded Authority → Content opportunities.
 * GREEN inspect/report only. Publish/send stay blocked.
 */

import { proposedActionImpliesWrite } from "../../permissions";
import type { ContentOpportunity } from "../types";
import { assessBrandFit } from "../brand-fit";
import {
  AUTHORITY_CASE_STUDY_INVENTORY_ID,
  AUTHORITY_OUTREACH_FOLLOW_UP_ID,
  buildNextCaseStudyOpportunityId,
} from "./ids";
import { classifyAuthorityPermissionTier } from "./permissions";
import type { AuthoritySnapshot } from "./types";

function withBrandFit(
  base: Omit<ContentOpportunity, "brandFitOk" | "brandFitNotes">,
): ContentOpportunity {
  const fit = assessBrandFit(
    `${base.title} ${base.recommendedAction} ${base.whyItMatters}`,
  );
  return { ...base, brandFitOk: fit.ok, brandFitNotes: fit.notes };
}

export function authoritySnapshotToOpportunities(
  snapshot: AuthoritySnapshot,
): ContentOpportunity[] {
  const out: ContentOpportunity[] = [];
  const cs = snapshot.caseStudies;

  if (cs.nextCaseStudy) {
    const next = cs.nextCaseStudy;
    const action = `Continue Case Study “${next.workingTitle}”: ${next.nextAction}. Agent OS does not apply site edits.`;
    out.push(
      withBrandFit({
        id: buildNextCaseStudyOpportunityId(next.caseStudyId),
        type: "case-study-production",
        title: `Next Case Study: ${next.workingTitle}`,
        whyItMatters:
          "Case Studies are the current publishing and sales-proof engine.",
        recommendedAction: action,
        recommendedFormat: "guide-enhancement",
        formatRationale:
          "Case Study production — not a Conversation cycle and not a social post.",
        topicOrItem: next.caseStudyId,
        targetAudience: "engagement-buyers",
        funnelStage: "trust",
        sourceMaterial: "Founder-affirmed Case Study ledger",
        confidence: 0.9,
        likelyImpact: 9,
        effort: "medium",
        urgency: snapshot.caseStudyFounderNow ? "high" : "medium",
        approvalRequired: classifyAuthorityPermissionTier(action) !== "green",
        supportingReference: "lib/agent-os/content/authority/ledger.ts",
        evidenceNotes: [
          `status=${next.status}`,
          `publicationState=${next.publicationState} (explicit; not inferred)`,
          "Epistemic class=observed ledger row",
          "GREEN: identify next action. Publish remains RED.",
        ],
        performanceInferred: true,
        isInference: false,
      }),
    );
  } else if (snapshot.caseStudyFounderNow) {
    const action =
      "Affirm the next Case Study in the Authority ledger. Do not invent a client story, geography, or Conversation substitute.";
    out.push(
      withBrandFit({
        id: AUTHORITY_CASE_STUDY_INVENTORY_ID,
        type: "case-study-founder-input",
        title: "Case Study inventory needs founder input",
        whyItMatters:
          cs.founderInputReason ??
          "Case Study production is founder-now, but no actionable Case Study is on the ledger.",
        recommendedAction: action,
        recommendedFormat: "guide-enhancement",
        formatRationale: "Founder input gate — not a content production request.",
        topicOrItem: "case-study-inventory",
        targetAudience: "founders-peers",
        funnelStage: "trust",
        sourceMaterial: "Empty or blocked founder-affirmed Case Study ledger",
        confidence: 0.92,
        likelyImpact: 8,
        effort: "low",
        urgency: "high",
        approvalRequired: false,
        supportingReference: "lib/agent-os/content/authority/ledger.ts",
        evidenceNotes: [
          `inventoryState=${cs.inventoryState}`,
          `founderAffirmedCount=${cs.founderAffirmedCount}`,
          "No fake Case Study created",
          "No Conversation substituted",
        ],
        performanceInferred: true,
        isInference: false,
      }),
    );
  }

  if (snapshot.outreach.founderTask === "follow-up-readiness") {
    const action =
      "Prepare follow-up copy for the current authority outreach wave for founder approval. No new contacts or new wave.";
    out.push(
      withBrandFit({
        id: AUTHORITY_OUTREACH_FOLLOW_UP_ID,
        type: "authority-outreach-follow-up",
        title: "Authority outreach follow-up window is due",
        whyItMatters:
          "The current wave was already sent; follow-up is the only remaining motion — still RED to send.",
        recommendedAction: action,
        recommendedFormat: "caption",
        formatRationale:
          "Follow-up readiness signal only. Agent OS does not send outreach.",
        topicOrItem: snapshot.outreach.waveId,
        targetAudience: "founders-peers",
        funnelStage: "awareness",
        sourceMaterial: "Management-affirmed authority outreach wave",
        confidence: 0.8,
        likelyImpact: 5,
        effort: "low",
        urgency: "medium",
        approvalRequired: true,
        supportingReference: "lib/agent-os/content/authority/ledger.ts",
        evidenceNotes: [
          `followUpEligibility=${snapshot.outreach.followUpEligibility}`,
          `sendDateEpistemicClass=${snapshot.outreach.sendDateEpistemicClass}`,
          "No contacts, publications, or PII in this recommendation",
          "Sending outreach is RED — no execution path",
        ],
        performanceInferred: true,
        isInference: false,
      }),
    );
  }

  return out.filter(
    (o) => o.brandFitOk && !proposedActionImpliesWrite(o.recommendedAction),
  );
}

export function isOrdinaryEditorialOpportunityType(
  type: ContentOpportunity["type"],
): boolean {
  return (
    type === "founder-conversation-topic" ||
    type === "follow-up-conversation" ||
    type === "editorial-roi-package" ||
    type === "short-form-clip" ||
    type === "carousel-opportunity" ||
    type === "caption-opportunity"
  );
}

export function isAuthorityOwnedOpportunityType(
  type: ContentOpportunity["type"],
): boolean {
  return (
    type === "case-study-production" ||
    type === "case-study-founder-input" ||
    type === "authority-outreach-follow-up"
  );
}
