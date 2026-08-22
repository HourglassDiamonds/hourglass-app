/**
 * Read-only Client Memory importer.
 * Never writes Persons, Events, or production rows.
 */

import type { ContinuumStore } from "../persistence/types";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "./types";
import { hashEmail, hashPhone } from "./hashes";
import { resolvePersonIdentity, type IdentityLookup } from "./identity";
import {
  InMemoryClientMemoryStore,
  newExternalIdentity,
  type ClientMemoryStore,
} from "./store";
import {
  WORKBOOK_AUDIT_EXPECTATIONS,
  hasNonEmpty,
  isFingerSizeCandidate,
  isProseCandidate,
  isProjectAttributeCandidate,
  parseReconciliationWorkbook,
  type ParsedWorkbook,
} from "./workbook";

export const APPLY_NOT_IMPLEMENTED =
  "APPLY NOT IMPLEMENTED IN CLIENT MEMORY V1 PHASE 1";

export type ClientMemoryDryRunResult = {
  mode: "dry-run";
  artifact: "continuum-reconciliation-v3";
  peopleRowsScanned: number;
  personCandidates: number;
  organizationCandidates: number;
  peopleNeedsReview: number;
  invalidPeople: number;
  wouldCreatePersons: number;
  wouldMatchPersons: number;
  identityCollisions: number;
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
  cadLinkedNames: number;
  cadUnresolvedNames: number;
  salesExactNameLinks: number;
  salesUniqueLinkedClients: number;
  salesAnomalyCount: number;
};

export type DryRunOptions = {
  store?: ClientMemoryStore;
  /** Present only so tests can prove generic Event payloads are never written. */
  continuumStore?: ContinuumStore | null;
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
  return dryRunParsedWorkbook(parsed, options);
}

export async function dryRunParsedWorkbook(
  parsed: ParsedWorkbook,
  options: DryRunOptions = {},
): Promise<ClientMemoryDryRunResult> {
  const store = options.store ?? new InMemoryClientMemoryStore();
  const shadow = new InMemoryClientMemoryStore();
  const lookup = new CompositeIdentityLookup(store, shadow);
  const now = "1970-01-01T00:00:00.000Z";

  let personCandidates = 0;
  let organizationCandidates = 0;
  let peopleNeedsReview = 0;
  let invalidPeople = 0;
  let wouldCreatePersons = 0;
  let wouldMatchPersons = 0;
  let identityCollisions = 0;

  for (const row of parsed.people) {
    if (row.classification === "person-candidate") personCandidates += 1;
    else if (row.classification === "organization-candidate") {
      organizationCandidates += 1;
    } else if (row.classification === "needs-review") peopleNeedsReview += 1;
    else invalidPeople += 1;

    if (row.classification !== "person-candidate") continue;

    const resolution = await resolvePersonIdentity(lookup, {
      email: row.email || null,
      phone: row.phone || null,
      importRowKey: row.importRowKey,
    });

    if (resolution.status === "matched") {
      wouldMatchPersons += 1;
      continue;
    }
    if (resolution.status === "review") {
      identityCollisions += 1;
      continue;
    }
    if (resolution.status === "invalid") {
      invalidPeople += 1;
      continue;
    }

    wouldCreatePersons += 1;
    const inserted = await shadow.insertEntity({
      kind: "person",
      createdAt: now,
      createdBy: "client-memory-dry-run",
    });
    const personId = inserted.record.id;
    const emailHash = hashEmail(row.email);
    const phoneHash = hashPhone(row.phone);
    await shadow.upsertExternalIdentity(
      newExternalIdentity({
        entityId: personId,
        sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        identityKind: "import_row_key",
        identifier: row.importRowKey,
        createdAt: now,
      }),
    );
    if (emailHash) {
      await shadow.upsertExternalIdentity(
        newExternalIdentity({
          entityId: personId,
          sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
          identityKind: "email_hash",
          identifier: emailHash,
          createdAt: now,
        }),
      );
    }
    if (phoneHash) {
      await shadow.upsertExternalIdentity(
        newExternalIdentity({
          entityId: personId,
          sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
          identityKind: "phone_hash",
          identifier: phoneHash,
          createdAt: now,
        }),
      );
    }
  }

  let projectsExactEligible = 0;
  let projectsReviewLink = 0;
  let projectsUnresolved = 0;
  let projectPersonExactLinks = 0;
  let malformedCellWarnings = 0;
  let sourceNotesDiscovered = 0;
  let fingerSizeCandidates = 0;
  let metalCandidates = 0;
  let centerStoneCandidates = 0;
  let supplyNoteCandidates = 0;
  let projectNotesPopulated = 0;
  let gmailThreadsDiscovered = 0;

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
      sourceNotesDiscovered += 1;
    }
    if (row.reviewFlagProse) sourceNotesDiscovered += 1;
    if (hasNonEmpty(row.gmailThreadId)) gmailThreadsDiscovered += 1;

    if (row.matchJudgment === "malformed-source-value") {
      malformedCellWarnings += 1;
      projectsReviewLink += 1;
      continue;
    }
    if (row.matchJudgment === "likely" || row.matchJudgment === "ambiguous") {
      projectsReviewLink += 1;
      continue;
    }
    if (row.matchJudgment === "no-exact") {
      projectsUnresolved += 1;
      continue;
    }

    const nameHits = parsed.peopleNameCounts.get(row.canonicalClient) ?? 0;
    if (nameHits === 1) {
      projectsExactEligible += 1;
      projectPersonExactLinks += 1;
    } else {
      projectsReviewLink += 1;
    }
  }

  let cadPointersDiscovered = 0;
  let cadLinkedNames = 0;
  let cadUnresolvedNames = 0;
  for (const row of parsed.cad) {
    cadPointersDiscovered += 1;
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
    peopleRowsScanned: parsed.people.length,
    personCandidates,
    organizationCandidates,
    peopleNeedsReview,
    invalidPeople,
    wouldCreatePersons,
    wouldMatchPersons,
    identityCollisions,
    projectRowsScanned: parsed.projects.length,
    projectsExactEligible,
    projectsReviewLink,
    projectsUnresolved,
    projectPersonExactLinks,
    sourceNotesDiscovered,
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
    cadLinkedNames,
    cadUnresolvedNames,
    salesExactNameLinks,
    salesUniqueLinkedClients: linkedSalesClients.size,
    salesAnomalyCount,
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
