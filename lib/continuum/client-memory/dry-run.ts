/**
 * Read-only Client Memory importer.
 * Never writes Persons, Events, or production rows.
 */

import type { ContinuumStore } from "../persistence/types";
import {
  AUDITED_RECONCILIATION_V3,
  fingerprintWorkbook,
  workbookFingerprintMatch,
} from "./artifact";
import { evaluatePersonRow } from "./eligibility";
import { type IdentityLookup } from "./identity";
import { buildWorkbookSidePlan, type ClientMemoryImportManifest } from "./plan";
import {
  InMemoryClientMemoryStore,
  newExternalIdentity,
  type ClientMemoryStore,
} from "./store";
import {
  CLIENT_MEMORY_SCHEMA_VERSION,
  CLIENT_MEMORY_SOURCE_SYSTEM,
} from "./types";
import {
  WORKBOOK_AUDIT_EXPECTATIONS,
  hasNonEmpty,
  isFingerSizeCandidate,
  isProseCandidate,
  isProjectAttributeCandidate,
  parseReconciliationWorkbook,
  type ParsedPersonRow,
  type ParsedWorkbook,
} from "./workbook";

export type ClientMemoryDryRunResult = {
  mode: "dry-run";
  artifact: "continuum-reconciliation-v3";
  schemaVersion: typeof CLIENT_MEMORY_SCHEMA_VERSION;
  sourceArtifactVersion: typeof AUDITED_RECONCILIATION_V3.sourceArtifactVersion;
  frozenSeed: true;
  workbookFingerprint: string;
  workbookFingerprintMatch: boolean;
  peopleRowsScanned: number;
  personCandidates: number;
  organizationCandidates: number;
  peopleNeedsReview: number;
  invalidPeople: number;
  unsupportedPhoneReviews: number;
  wouldCreatePersons: number;
  wouldMatchPersons: number;
  identityCollisions: number;
  identityWarnings: number;
  identityConflicts: number;
  personsEligible: number;
  projectRowsScanned: number;
  projectsExactEligible: number;
  projectsReviewLink: number;
  projectsUnresolved: number;
  projectPersonExactLinks: number;
  sourceNotesDiscovered: number;
  cadPointersDiscovered: number;
  salesRowsDiscovered: number;
  reviewRowsDiscovered: number;
  fingerSizeCandidates: number;
  metalCandidates: number;
  centerStoneCandidates: number;
  supplyNoteCandidates: number;
  relationshipCandidates: number;
  wishCandidates: number;
  vendorRowsSkipped: number;
  workbookDriftWarnings: string[];
  malformedCellWarnings: number;
  projectNotesPopulated: number;
  gmailThreadsDiscovered: number;
  gmailThreadsCanonical: number;
  gmailThreadsInvalid: number;
  cadLinkedNames: number;
  cadUnresolvedNames: number;
  salesExactNameLinks: number;
  salesUniqueLinkedClients: number;
  salesAnomalyCount: number;
  factsWouldCreate: 0;
  wishesWouldCreate: 0;
  reviewsWouldOpen: number;
  manifest: ClientMemoryImportManifest;
};

export type DryRunOptions = {
  store?: ClientMemoryStore;
  /** Present only so tests can prove generic Event payloads are never written. */
  continuumStore?: ContinuumStore | null;
  expectedFingerprint?: string | null;
};

class CompositeIdentityLookup implements IdentityLookup {
  constructor(
    private readonly primary: ClientMemoryStore,
    private readonly shadow: ClientMemoryStore,
  ) {}

  async findActiveIdentities(input: {
    identityKind: Parameters<IdentityLookup["findActiveIdentities"]>[0]["identityKind"];
    identifier: string;
  }) {
    const [a, b] = await Promise.all([
      this.primary.findActiveIdentities(input),
      this.shadow.findActiveIdentities(input),
    ]);
    const seen = new Set<string>();
    const merged = [];
    for (const row of [...a, ...b]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
    }
    return merged;
  }
}

export function dryRunReconciliationWorkbook(
  buffer: Uint8Array,
  options: DryRunOptions = {},
): Promise<ClientMemoryDryRunResult> {
  const parsed = parseReconciliationWorkbook(buffer);
  const fingerprint = fingerprintWorkbook(buffer);
  const match =
    options.expectedFingerprint != null
      ? fingerprint === options.expectedFingerprint
      : workbookFingerprintMatch(buffer);
  return dryRunParsedWorkbook(parsed, options, { fingerprint, match });
}

export async function dryRunParsedWorkbook(
  parsed: ParsedWorkbook,
  options: DryRunOptions = {},
  fingerprint: { fingerprint: string; match: boolean } = {
    fingerprint: "synthetic",
    match: false,
  },
): Promise<ClientMemoryDryRunResult> {
  const store = options.store ?? new InMemoryClientMemoryStore();
  const shadow = new InMemoryClientMemoryStore();
  const lookup = new CompositeIdentityLookup(store, shadow);
  const now = "1970-01-01T00:00:00.000Z";

  let personCandidates = 0;
  let organizationCandidates = 0;
  let peopleNeedsReview = 0;
  let invalidPeople = 0;
  let unsupportedPhoneReviews = 0;
  let wouldCreatePersons = 0;
  let wouldMatchPersons = 0;
  let identityCollisions = 0;

  const people: Array<{
    row: ParsedPersonRow;
    evaluation: Awaited<ReturnType<typeof evaluatePersonRow>>;
  }> = [];

  for (const row of parsed.people) {
    if (row.classification === "person-candidate") personCandidates += 1;
    else if (row.classification === "organization-candidate") {
      organizationCandidates += 1;
    } else if (row.classification === "needs-review") peopleNeedsReview += 1;
    else invalidPeople += 1;

    const evaluation = await evaluatePersonRow(lookup, row);
    people.push({ row, evaluation });

    if (evaluation.identityWarnings.includes("REVIEW_UNSUPPORTED_PHONE")) {
      unsupportedPhoneReviews += 1;
    }

    if (evaluation.eligibility === "invalid") {
      if (row.classification === "person-candidate") invalidPeople += 1;
      continue;
    }
    if (evaluation.eligibility === "identity-conflict") {
      identityCollisions += 1;
      continue;
    }
    if (evaluation.mutation === "match") {
      wouldMatchPersons += 1;
      continue;
    }
    if (evaluation.mutation !== "create") continue;

    wouldCreatePersons += 1;
    const inserted = await shadow.insertEntity({
      kind: "person",
      createdAt: now,
      createdBy: "client-memory-dry-run",
    });
    const personId = inserted.record.id;
    for (const claim of evaluation.validIdentityClaims) {
      await shadow.upsertExternalIdentity(
        newExternalIdentity({
          entityId: personId,
          sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
          identityKind: claim.identityKind,
          identifier: claim.identifier,
          createdAt: now,
        }),
      );
    }
  }

  const side = buildWorkbookSidePlan(parsed, people);

  let malformedCellWarnings = 0;
  let fingerSizeCandidates = 0;
  let metalCandidates = 0;
  let centerStoneCandidates = 0;
  let supplyNoteCandidates = 0;
  let projectNotesPopulated = 0;
  let gmailThreadsDiscovered = 0;
  let gmailThreadsCanonical = 0;
  let gmailThreadsInvalid = 0;

  for (const row of parsed.projects) {
    if (row.matchConfidenceMalformed) malformedCellWarnings += 1;
    if (row.reviewFlagMalformed) malformedCellWarnings += 1;
    if (isFingerSizeCandidate(row.fingerSize)) fingerSizeCandidates += 1;
    if (isProseCandidate(row.metal)) metalCandidates += 1;
    if (isProjectAttributeCandidate(row.centerStone)) {
      centerStoneCandidates += 1;
    }
    if (isProjectAttributeCandidate(row.supplyNotes)) {
      supplyNoteCandidates += 1;
    }
    if (isProseCandidate(row.notes)) {
      projectNotesPopulated += 1;
    }
    if (hasNonEmpty(row.gmailThreadId)) gmailThreadsDiscovered += 1;
    if (row.gmailThread.status === "canonical") gmailThreadsCanonical += 1;
    if (row.gmailThread.status === "invalid") {
      gmailThreadsInvalid += 1;
    }

    if (row.matchJudgment === "malformed-source-value") {
      malformedCellWarnings += 1;
    }
  }

  let cadPointersDiscovered = 0;
  let cadLinkedNames = 0;
  let cadUnresolvedNames = 0;
  for (const row of parsed.cad) {
    cadPointersDiscovered += 1;
    if (row.gmailThread.status === "canonical") gmailThreadsCanonical += 1;
    if (row.gmailThread.status === "invalid") gmailThreadsInvalid += 1;
    if (!hasNonEmpty(row.client)) {
      cadUnresolvedNames += 1;
      continue;
    }
    if ((parsed.peopleNameCounts.get(row.client) ?? 0) === 1) cadLinkedNames += 1;
    else cadUnresolvedNames += 1;
  }

  const linkedSalesClients = new Set<string>();
  let salesExactNameLinks = 0;
  let salesAnomalyCount = 0;
  for (const row of parsed.sales) {
    if (!hasNonEmpty(row.client)) {
      salesAnomalyCount += 1;
      continue;
    }
    if ((parsed.peopleNameCounts.get(row.client) ?? 0) === 1) {
      salesExactNameLinks += 1;
      linkedSalesClients.add(row.client);
    } else {
      salesAnomalyCount += 1;
    }
  }

  const workbookDriftWarnings = buildDriftWarnings(parsed);
  void options.continuumStore;

  return {
    mode: "dry-run",
    artifact: "continuum-reconciliation-v3",
    schemaVersion: CLIENT_MEMORY_SCHEMA_VERSION,
    sourceArtifactVersion: AUDITED_RECONCILIATION_V3.sourceArtifactVersion,
    frozenSeed: true,
    workbookFingerprint: fingerprint.fingerprint,
    workbookFingerprintMatch: fingerprint.match,
    peopleRowsScanned: parsed.people.length,
    personCandidates,
    organizationCandidates,
    peopleNeedsReview,
    invalidPeople,
    unsupportedPhoneReviews,
    wouldCreatePersons,
    wouldMatchPersons,
    identityCollisions,
    identityWarnings: side.manifest.identityWarnings,
    identityConflicts: side.manifest.identityConflicts,
    personsEligible: side.manifest.personsEligible,
    projectRowsScanned: parsed.projects.length,
    projectsExactEligible: side.manifest.projectsExactEligible,
    projectsReviewLink: side.manifest.projectsReviewLink,
    projectsUnresolved: side.manifest.projectsUnresolved,
    projectPersonExactLinks: side.manifest.projectsExactEligible,
    sourceNotesDiscovered: side.manifest.sourceNotesWouldCreate,
    cadPointersDiscovered,
    salesRowsDiscovered: parsed.sales.length,
    reviewRowsDiscovered: parsed.reviewQueue.length,
    fingerSizeCandidates,
    metalCandidates,
    centerStoneCandidates,
    supplyNoteCandidates,
    relationshipCandidates: 0,
    wishCandidates: 0,
    vendorRowsSkipped: parsed.vloraRows,
    workbookDriftWarnings,
    malformedCellWarnings,
    projectNotesPopulated,
    gmailThreadsDiscovered,
    gmailThreadsCanonical,
    gmailThreadsInvalid,
    cadLinkedNames,
    cadUnresolvedNames,
    salesExactNameLinks,
    salesUniqueLinkedClients: linkedSalesClients.size,
    salesAnomalyCount,
    factsWouldCreate: 0,
    wishesWouldCreate: 0,
    reviewsWouldOpen: side.manifest.reviewsWouldOpen,
    manifest: side.manifest,
  };
}

function buildDriftWarnings(parsed: ParsedWorkbook): string[] {
  const warnings: string[] = [
    "rules-and-summary-ignored-as-authoritative-count",
  ];
  for (const name of parsed.missingSheets) {
    warnings.push(`missing-sheet:${name}`);
  }
  const actual: Record<string, number> = {
    People: parsed.people.length,
    "Reconciled Projects": parsed.projects.length,
    "Sales History": parsed.sales.length,
    "CAD & Files": parsed.cad.length,
    "Review Queue": parsed.reviewQueue.length,
    "Vlora Sources": parsed.vloraRows,
  };
  for (const [sheet, expected] of Object.entries(WORKBOOK_AUDIT_EXPECTATIONS)) {
    const got = actual[sheet];
    if (got !== expected) {
      warnings.push(`sheet-count-drift:${sheet}:${got}-vs-${expected}`);
    }
  }
  return warnings;
}
