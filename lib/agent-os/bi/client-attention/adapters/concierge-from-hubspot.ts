/**
 * Reconstruct Concierge submissions from HubSpot deal descriptions written
 * by the live Concierge write path (buildDealDescription).
 * Read-only — never mutates CRM. Does not create a submission ledger.
 */

import { normalizeEmail, normalizePhone, safeDisplayName } from "../hash";
import type {
  ConciergeAdapterResult,
  NormalizedConciergeSubmission,
  NormalizedHubSpotContact,
  NormalizedHubSpotDeal,
} from "./types";

const NOT_PROVIDED = /^not provided$/i;

export type ParsedConciergeDealDescription = {
  submissionId?: string;
  projectType?: string;
  shapeInterest?: string;
  designDirection?: string;
  ringPresence?: string;
  timeline?: string;
  budgetRange?: string;
  preferredContact?: string;
  source?: string;
  originatingTool?: string;
  originatingContent?: string;
  landingPath?: string;
  utmSource?: string;
  inspirationNotes?: string;
  /** Fields that were present as labeled lines but empty / "Not provided". */
  emptyLabeledFields: string[];
  /** Fields that could not be found as labeled lines at all. */
  missingLabeledFields: string[];
};

const EXPECTED_LABELS = [
  "Submission ID",
  "Project Type",
  "Shape Interest",
  "Design Direction",
  "Ring Presence",
  "Timeline",
  "Budget Range",
  "Preferred Contact",
  "Source",
] as const;

/**
 * Parse free-text deal description produced by Concierge createDeal.
 */
export function parseConciergeDealDescription(
  description: string | null | undefined,
): ParsedConciergeDealDescription {
  const emptyLabeledFields: string[] = [];
  const missingLabeledFields: string[] = [];
  const text = (description || "").replace(/\r\n/g, "\n");

  const lineValue = (
    label: string,
    opts?: { trackMissing?: boolean; trackEmpty?: boolean },
  ): string | undefined => {
    const trackMissing = opts?.trackMissing !== false;
    const trackEmpty = opts?.trackEmpty !== false;
    const re = new RegExp(`^${escapeRegExp(label)}:\\s*(.*)$`, "im");
    const match = text.match(re);
    if (!match) {
      if (trackMissing) missingLabeledFields.push(label);
      return undefined;
    }
    const raw = (match[1] || "").trim();
    if (!raw || NOT_PROVIDED.test(raw)) {
      if (trackEmpty) emptyLabeledFields.push(label);
      return undefined;
    }
    return raw;
  };

  const attributionBlock = extractSection(text, "Attribution:");
  const inspirationBlock =
    extractSection(text, "Inspiration / Notes:") ||
    extractSection(text, "Notes:");

  const budgetRange =
    lineValue("Budget Range") ||
    lineValue("Budget", { trackMissing: false, trackEmpty: false });

  return {
    submissionId: lineValue("Submission ID"),
    projectType: lineValue("Project Type"),
    shapeInterest: lineValue("Shape Interest"),
    designDirection: lineValue("Design Direction"),
    ringPresence: lineValue("Ring Presence"),
    timeline: lineValue("Timeline"),
    budgetRange,
    preferredContact: lineValue("Preferred Contact"),
    source: lineValue("Source"),
    originatingTool: attributionLine(attributionBlock, "Originating Tool"),
    originatingContent: attributionLine(attributionBlock, "Originating Content"),
    landingPath: attributionLine(attributionBlock, "Landing path"),
    utmSource: attributionLine(attributionBlock, "UTM Source"),
    inspirationNotes: inspirationBlock?.trim() || undefined,
    emptyLabeledFields: [...new Set(emptyLabeledFields)],
    missingLabeledFields: [...new Set(missingLabeledFields)].filter((label) =>
      (EXPECTED_LABELS as readonly string[]).includes(label),
    ),
  };
}

export type ConciergeReconstructionReport = {
  reconstructableFromHubSpot: string[];
  requiresFutureSubmissionLedger: string[];
  notes: string[];
};

/**
 * Static quality report — what Concierge fields HubSpot can vs cannot provide.
 */
export function conciergeReconstructionQualityReport(): ConciergeReconstructionReport {
  return {
    reconstructableFromHubSpot: [
      "submissionId (from deal description line)",
      "submittedAt (approximate: deal createdate)",
      "contact identity (associated contact email/phone/name)",
      "deal id + contact id association",
      "projectType, timeline, budgetRange, designDirection, shapeInterest, ringPresence",
      "preferredContact (description line; optional contact property if present)",
      "attribution lines when Concierge wrote them into description/note",
      "inspiration notes presence (safe summary only — not full free text in audits)",
    ],
    requiresFutureSubmissionLedger: [
      "exact HTTP accept/reject outcome vs soft-accept (CRM only has successful writes)",
      "raw validated payload before HubSpot property rejection/retry (e.g. preferred_contact_method dropped)",
      "inspiration notes as structured field without scraping free-text description",
      "server-side submission timestamp independent of HubSpot createdate clock",
      "idempotency / duplicate-submit detection across retries",
      "submissions that soft-accepted when HubSpot write failed (visitor saw success, CRM empty)",
    ],
    notes: [
      "Concierge stores inquiry details primarily in deal description (+ optional note), not discrete custom deal properties.",
      "preferred_contact_method may exist on the contact only when the HubSpot portal accepts that property.",
      "Do not build the ledger in this sprint.",
    ],
  };
}

export type ReconstructConciergeOptions = {
  deals: NormalizedHubSpotDeal[];
  contacts: NormalizedHubSpotContact[];
  /** Raw deal descriptions keyed by dealId (not stored on normalized deal). */
  dealDescriptions: Record<string, string | undefined>;
  nowIso: string;
  maxSubmissions: number;
};

/**
 * Build Concierge adapter result from HubSpot deals that look like Concierge writes.
 */
export function reconstructConciergeFromHubSpot(
  options: ReconstructConciergeOptions,
): ConciergeAdapterResult {
  const contactById = new Map(
    options.contacts.map((c) => [c.contactId, c] as const),
  );
  const submissions: NormalizedConciergeSubmission[] = [];

  for (const deal of options.deals) {
    if (submissions.length >= options.maxSubmissions) break;
    const description = options.dealDescriptions[deal.dealId];
    const parsed = parseConciergeDealDescription(description);
    const looksLikeConcierge =
      Boolean(parsed.submissionId) ||
      Boolean(parsed.projectType) ||
      /concierge/i.test(deal.dealName || "") ||
      /Submission ID:/i.test(description || "");

    if (!looksLikeConcierge) continue;

    const primaryContact = deal.contactIds
      .map((id) => contactById.get(id))
      .find(Boolean);
    const email =
      normalizeEmail(primaryContact?.normalizedEmail) ?? undefined;
    const phone =
      normalizePhone(primaryContact?.normalizedPhone) ?? undefined;

    const fullName = safeDisplayName({
      firstName: primaryContact?.firstName,
      lastName: primaryContact?.lastName,
      fallback: deal.dealName?.split("–")[0]?.trim() || "A client",
    });

    submissions.push({
      submissionId: parsed.submissionId || `hubspot-deal:${deal.dealId}`,
      accepted: true,
      submittedAt: deal.createdAt || deal.lastActivityAt || options.nowIso,
      normalizedEmail: email,
      normalizedPhone: phone,
      firstName: primaryContact?.firstName,
      lastName: primaryContact?.lastName,
      fullName,
      projectType: parsed.projectType,
      timeline: parsed.timeline,
      budgetRange: parsed.budgetRange,
      preferredContactMethod:
        parsed.preferredContact || primaryContact?.conciergePreferredContact,
      designDirection: parsed.designDirection,
      ringPresence: parsed.ringPresence,
      shapeInterest: parsed.shapeInterest,
      inspirationNotesSafeSummary: safeNotesSummary(parsed.inspirationNotes),
      originatingTool: parsed.originatingTool,
      originatingContent: parsed.originatingContent,
      landingPath: parsed.landingPath,
      hubspotContactId: primaryContact?.contactId,
      hubspotDealId: deal.dealId,
    });
  }

  if (!submissions.length) {
    return {
      sourceType: "concierge",
      status: "empty",
      collectedAt: options.nowIso,
      recordCount: 0,
      submissions: [],
      configurationNote:
        "No Concierge-shaped deal descriptions found in the bounded HubSpot deal window.",
    };
  }

  return {
    sourceType: "concierge",
    status: "ok",
    collectedAt: options.nowIso,
    recordCount: submissions.length,
    submissions,
    configurationNote:
      "Concierge submissions reconstructed read-only from HubSpot deal descriptions (no separate ledger).",
  };
}

/**
 * Enrich HubSpot contacts with Concierge fields parsed from associated deals.
 */
export function enrichContactsFromConciergeDeals(
  contacts: NormalizedHubSpotContact[],
  deals: NormalizedHubSpotDeal[],
  dealDescriptions: Record<string, string | undefined>,
): NormalizedHubSpotContact[] {
  const dealByContact = new Map<string, { deal: NormalizedHubSpotDeal; description?: string }>();
  for (const deal of deals) {
    const description = dealDescriptions[deal.dealId];
    for (const contactId of deal.contactIds) {
      if (!dealByContact.has(contactId)) {
        dealByContact.set(contactId, { deal, description });
      }
    }
  }

  return contacts.map((contact) => {
    const linked = dealByContact.get(contact.contactId);
    if (!linked) return contact;
    const parsed = parseConciergeDealDescription(linked.description);
    return {
      ...contact,
      conciergeProjectType: parsed.projectType ?? contact.conciergeProjectType,
      conciergeTimeline: parsed.timeline ?? contact.conciergeTimeline,
      conciergeBudgetRange: parsed.budgetRange ?? contact.conciergeBudgetRange,
      conciergePreferredContact:
        parsed.preferredContact ?? contact.conciergePreferredContact,
      sourceAttribution:
        parsed.utmSource ||
        parsed.originatingTool ||
        parsed.landingPath ||
        contact.sourceAttribution,
      notesSummary:
        contact.notesSummary || safeNotesSummary(parsed.inspirationNotes),
    };
  });
}

function safeNotesSummary(notes: string | undefined): string | undefined {
  if (!notes?.trim()) return undefined;
  const cleaned = notes.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 80) return "Inspiration notes on file.";
  return "Inspiration notes on file (truncated).";
}

function attributionLine(block: string | undefined, label: string): string | undefined {
  if (!block) return undefined;
  const re = new RegExp(`^${escapeRegExp(label)}:\\s*(.*)$`, "im");
  const match = block.match(re);
  const value = match?.[1]?.trim();
  return value && !NOT_PROVIDED.test(value) ? value : undefined;
}

function extractSection(text: string, header: string): string | undefined {
  const idx = text.toLowerCase().indexOf(header.toLowerCase());
  if (idx < 0) return undefined;
  const after = text.slice(idx + header.length).replace(/^\s*\n?/, "");
  const nextHeader = after.search(/\n[A-Z][^\n]{0,40}:\s*\n/);
  if (nextHeader >= 0) return after.slice(0, nextHeader).trim();
  // Stop at blank line followed by another labeled block start
  const parts = after.split(/\n\n+/);
  return parts[0]?.trim() || undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
