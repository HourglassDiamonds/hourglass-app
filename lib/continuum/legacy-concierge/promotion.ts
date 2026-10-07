import { createHash } from "node:crypto";
import type { ContinuumSourceSystem } from "@/lib/continuum/contracts/types";
import type { ClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { DEFAULT_VISIBILITY } from "@/lib/continuum/client-memory/types";

export const LEGACY_CONCIERGE_SOURCE: ContinuumSourceSystem = "hubspot";

export const LEGACY_CONCIERGE_PROGRESS_SIGNALS = [
  "cad_or_design",
  "stones_or_materials_ordered",
  "in_person_review",
  "scheduled_consultation",
  "active_current_communication",
] as const;

export type LegacyConciergeProgressSignal =
  (typeof LEGACY_CONCIERGE_PROGRESS_SIGNALS)[number];

export type LegacyConciergeEvidence = {
  provenance: "legacy_hubspot_concierge";
  hubspotDealId: string;
  hubspotContactId?: string | null;
  fullName: string;
  email: string;
  gmailThreadId: string;
  firstEvidenceAt: string;
  latestEvidenceAt: string;
  inboundMessageCount: number;
  outboundMessageCount: number;
  identityEvidence: Array<"hubspot_contact_email" | "repeated_gmail_participant">;
  explicitJewelryProject: boolean;
  projectTitle: string;
  cadJobNumber?: string | null;
  metal?: string | null;
  centerStone?: string | null;
  diamondSupplyNotes?: string | null;
  progressSignals: LegacyConciergeProgressSignal[];
  currentAction?: {
    kind: "scheduled_consultation";
    subject: string;
    detail?: string | null;
    dueAt: string;
  } | null;
};

export type LegacyConciergeAssessment =
  | { qualified: true; evidenceScore: number; reasons: string[] }
  | { qualified: false; evidenceScore: number; reasons: string[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CAD_RE = /^C\d{6}$/i;

export function assessLegacyConciergePromotion(
  evidence: LegacyConciergeEvidence,
): LegacyConciergeAssessment {
  const failures: string[] = [];
  const email = evidence.email.trim().toLowerCase();
  const first = Date.parse(evidence.firstEvidenceAt);
  const latest = Date.parse(evidence.latestEvidenceAt);
  const signals = new Set(evidence.progressSignals);
  const identities = new Set(evidence.identityEvidence);

  if (!/^\d{6,20}$/.test(evidence.hubspotDealId.trim())) failures.push("missing-legacy-hubspot-deal");
  if (!evidence.fullName.trim() || !EMAIL_RE.test(email)) failures.push("invalid-confirmed-identity");
  if (!evidence.gmailThreadId.trim()) failures.push("missing-gmail-thread");
  if (!Number.isFinite(first) || !Number.isFinite(latest) || latest <= first) failures.push("invalid-evidence-window");
  if (Number.isFinite(first) && Number.isFinite(latest) && latest - first < 24 * 60 * 60 * 1000) {
    failures.push("insufficient-sustained-communication");
  }
  if (evidence.inboundMessageCount < 2 || evidence.outboundMessageCount < 2) failures.push("insufficient-two-way-communication");
  if (!identities.has("repeated_gmail_participant") || (!identities.has("hubspot_contact_email") && !evidence.hubspotContactId?.trim())) {
    failures.push("identity-not-cross-source-confirmed");
  }
  if (!evidence.explicitJewelryProject || !evidence.projectTitle.trim()) failures.push("no-explicit-jewelry-project");
  if (signals.size < 3) failures.push("insufficient-project-progression");
  if (evidence.cadJobNumber && !CAD_RE.test(evidence.cadJobNumber.trim())) failures.push("invalid-cad-identity");
  if (evidence.currentAction) {
    const due = Date.parse(evidence.currentAction.dueAt);
    if (
      evidence.currentAction.kind !== "scheduled_consultation" ||
      !evidence.currentAction.subject.trim() ||
      !Number.isFinite(due) ||
      (Number.isFinite(first) && due < first) ||
      (Number.isFinite(latest) && due > latest + 24 * 60 * 60 * 1000)
    ) failures.push("invalid-current-action");
  }

  const evidenceScore =
    (identities.size >= 2 ? 2 : identities.size) +
    (evidence.inboundMessageCount >= 2 && evidence.outboundMessageCount >= 2 ? 2 : 0) +
    (evidence.explicitJewelryProject ? 2 : 0) +
    Math.min(signals.size, 5) +
    (evidence.cadJobNumber ? 1 : 0);
  return failures.length
    ? { qualified: false, evidenceScore, reasons: failures }
    : { qualified: true, evidenceScore, reasons: ["strong-cross-source-identity-and-project-evidence"] };
}

export function legacyConciergeStableUuid(label: string): string {
  const hex = createHash("sha256").update(label).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ["8", "9", "a", "b"][parseInt(hex[16]!, 16) % 4]!;
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export type LegacyConciergePromotionResult =
  | { ok: false; status: "needs-review"; reasons: string[] }
  | { ok: true; status: "created" | "already-present"; personId: string; projectId: string };

export async function promoteLegacyConciergeLead(
  store: ClientMemoryStore,
  evidence: LegacyConciergeEvidence,
): Promise<LegacyConciergePromotionResult> {
  const assessment = assessLegacyConciergePromotion(evidence);
  if (!assessment.qualified) return { ok: false, status: "needs-review", reasons: assessment.reasons };

  const { hashEmail } = await import("@/lib/continuum/client-memory/hashes");
  const email = evidence.email.trim().toLowerCase();
  const emailHash = hashEmail(email);
  if (!emailHash) return { ok: false, status: "needs-review", reasons: ["invalid-confirmed-identity"] };
  const contactId = evidence.hubspotContactId?.trim() || null;
  const identityRows = await Promise.all([
    store.findActiveIdentities({ identityKind: "email_hash", identifier: emailHash }),
    contactId
      ? store.findActiveIdentities({ identityKind: "hubspot_contact_id", identifier: contactId })
      : Promise.resolve([]),
  ]);
  const matchedPeople = [...new Set(identityRows.flat().map((row) => row.entityId).filter((id): id is string => Boolean(id)))];
  if (matchedPeople.length > 1) return { ok: false, status: "needs-review", reasons: ["cross-source-identity-conflict"] };

  const now = evidence.latestEvidenceAt;
  const personId = matchedPeople[0] ?? legacyConciergeStableUuid(`legacy-concierge:person:${emailHash}`);
  const identities = [
    { id: legacyConciergeStableUuid(`legacy-concierge:email:${emailHash}`), identityKind: "email_hash" as const, identifier: emailHash, sourceSystem: LEGACY_CONCIERGE_SOURCE },
    ...(contactId ? [{ id: legacyConciergeStableUuid(`legacy-concierge:contact:${contactId}`), identityKind: "hubspot_contact_id" as const, identifier: contactId, sourceSystem: LEGACY_CONCIERGE_SOURCE }] : []),
  ];
  if (matchedPeople.length === 0) {
    const parts = evidence.fullName.trim().split(/\s+/);
    await store.createPersonAtomic({
      entityId: personId,
      createdAt: evidence.firstEvidenceAt,
      createdBy: "legacy-concierge-promotion",
      profile: {
        displayName: evidence.fullName.trim(),
        givenName: parts[0] ?? null,
        familyName: parts.length > 1 ? parts.slice(1).join(" ") : null,
        organizationName: null,
        email,
        phone: null,
        streetAddress: null,
        city: null,
        state: null,
        country: null,
        postalCode: null,
        roles: ["client"],
        sourceSystem: LEGACY_CONCIERGE_SOURCE,
        createdAt: evidence.firstEvidenceAt,
        updatedAt: now,
      },
      identities,
    });
  } else {
    const added = await store.applyExistingPersonAtomic({
      personId,
      updatedAt: now,
      profile: {},
      roles: ["client"],
      identities: contactId ? [identities.at(-1)!].map((row) => ({ ...row, createdAt: now })) : [],
    });
    if (added.status === "conflict") return { ok: false, status: "needs-review", reasons: [added.reason] };
  }

  const importRowKey = `legacy-concierge:hubspot-deal:${evidence.hubspotDealId.trim()}`;
  const existing = await store.findProjectByImportRowKey({ sourceSystem: LEGACY_CONCIERGE_SOURCE, importRowKey });
  const projectId = existing?.projectId ?? legacyConciergeStableUuid(importRowKey);
  const projectEntity = await store.insertEntity({ id: projectId, kind: "project", createdAt: evidence.firstEvidenceAt, createdBy: "legacy-concierge-promotion" });
  if (projectEntity.record.kind !== "project") return { ok: false, status: "needs-review", reasons: ["project-identity-conflict"] };
  const profile = await store.insertProjectProfile({
    projectId,
    displayTitle: evidence.projectTitle.trim(),
    visibility: DEFAULT_VISIBILITY,
    importRowKey,
    sourceSystem: LEGACY_CONCIERGE_SOURCE,
    createdAt: evidence.firstEvidenceAt,
    updatedAt: now,
  });
  if (profile.record.projectId !== projectId) return { ok: false, status: "needs-review", reasons: ["project-import-key-conflict"] };
  await store.insertProjectHistory({
    projectId,
    cadJobNumber: evidence.cadJobNumber?.trim().toUpperCase() || null,
    orderNumber: null,
    gmailThreadId: evidence.gmailThreadId.trim(),
    matchJudgment: "exact",
    matchJudgmentRaw: "legacy HubSpot Concierge + exact repeated Gmail identity",
    fingerSize: null,
    metal: evidence.metal?.trim() || null,
    centerStone: evidence.centerStone?.trim() || null,
    diamondSupplyNotes: evidence.diamondSupplyNotes?.trim() || null,
    sourceSystem: LEGACY_CONCIERGE_SOURCE,
    createdAt: evidence.firstEvidenceAt,
    updatedAt: now,
  });
  await store.insertRelationship({
    id: legacyConciergeStableUuid(`${importRowKey}:client-project`),
    fromEntityId: personId,
    toEntityId: projectId,
    kind: "client-project",
    status: "active",
    sourceSystem: LEGACY_CONCIERGE_SOURCE,
    createdAt: evidence.firstEvidenceAt,
    createdBy: "legacy-concierge-promotion",
  });

  const currentProfile = await store.getProjectProfile(projectId);
  if (!currentProfile) throw new Error("legacy-project-profile-missing");
  await store.applyProjectKindCorrection({
    mutationId: legacyConciergeStableUuid(`${importRowKey}:project-kind`),
    revisionId: legacyConciergeStableUuid(`${importRowKey}:project-kind-revision`),
    projectId,
    priorValue: currentProfile.projectKind ?? null,
    newValue: "custom_new_jewelry",
    changedAt: now,
    changedBy: "legacy-concierge-promotion",
    prior: currentProfile,
    next: { ...currentProfile, projectKind: "custom_new_jewelry", updatedAt: now },
  });
  await store.applyProjectLifecycleMutation({
    mutationId: legacyConciergeStableUuid(`${importRowKey}:lifecycle`),
    eventId: legacyConciergeStableUuid(`${importRowKey}:lifecycle-event`),
    projectId,
    priorStage: null,
    newStage: evidence.cadJobNumber ? "cad" : "design",
    changedAt: now,
    changedBy: "legacy-concierge-promotion",
  });
  const linked = await store.hasActiveClientProjectLink(personId, projectId);
  if (!linked) throw new Error("legacy-client-project-link-missing");
  return {
    ok: true,
    status: existing ? "already-present" : "created",
    personId,
    projectId,
  };
}
