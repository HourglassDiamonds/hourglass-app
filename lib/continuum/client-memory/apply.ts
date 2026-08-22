/**
 * Client Memory apply importer.
 * Callable only with explicit apply intent. Default path remains dry-run.
 * Does not log names, emails, phones, addresses, notes, or project prose.
 */

import { randomUUID } from "node:crypto";
import {
  AUDITED_RECONCILIATION_V3,
  fingerprintWorkbook,
} from "./artifact";
import { splitDisplayName } from "./classify";
import { DEFAULT_VISIBILITY } from "./contracts";
import { evaluateApplyGates, type ApplyTarget } from "./gates";
import { classifyPhone } from "./hashes";
import { prepareIdentityClaims, resolvePersonIdentity } from "./identity";
import {
  InMemoryClientMemoryStore,
  type ClientMemoryStore,
} from "./store";
import {
  CLIENT_MEMORY_SCHEMA_VERSION,
  CLIENT_MEMORY_SOURCE_SYSTEM,
  type PersonProfile,
  type ProjectHistory,
} from "./types";
import {
  isProseCandidate,
  parseReconciliationWorkbook,
  type ParsedPersonRow,
  type ParsedProjectRow,
  type ParsedWorkbook,
} from "./workbook";
import { cellText, type CellScalar } from "./xlsx";

export type ApplyOptions = {
  apply: boolean;
  confirmProductionClientImport: boolean;
  envEnabled: boolean;
  target: ApplyTarget | null;
  store?: ClientMemoryStore;
  implementationCommit?: string | null;
  /** Test-only: compare fingerprint to this hash instead of the audited v3 file. */
  expectedFingerprint?: string | null;
};

export type ApplyFailure = {
  ok: false;
  mode: "apply-rejected";
  reason: string;
};

export type ApplySuccess = {
  ok: true;
  mode: "apply";
  target: ApplyTarget;
  schemaVersion: typeof CLIENT_MEMORY_SCHEMA_VERSION;
  sourceArtifactVersion: typeof AUDITED_RECONCILIATION_V3.sourceArtifactVersion;
  workbookFingerprintMatch: true;
  implementationCommit: string | null;
  personsCreated: number;
  personsMatched: number;
  personsUnchanged: number;
  profilesPopulated: number;
  identitiesAttached: number;
  reviewsOpened: number;
  sourceNotesInserted: number;
  sourceNotesAlreadyPresent: number;
  projectsCreated: number;
  projectHistoriesCreated: number;
  projectPersonLinks: number;
  skippedNeedsReview: number;
  skippedOrganization: number;
  skippedUnsupportedPhone: number;
  skippedInvalidPeople: number;
  identityConflicts: number;
  profileConflicts: number;
  projectsExactLinked: number;
  projectsReviewUnlinked: number;
  projectsUnresolved: number;
  reviewQueueImported: number;
  vendorRowsSkipped: number;
};

export type ApplyResult = ApplyFailure | ApplySuccess;

const CREATED_BY = "client-memory-apply";

export async function applyReconciliationWorkbook(
  buffer: Uint8Array,
  options: ApplyOptions,
): Promise<ApplyResult> {
  const actualHash = fingerprintWorkbook(buffer);
  const expected =
    options.expectedFingerprint ?? AUDITED_RECONCILIATION_V3.sha256;
  const fingerprintMatch = actualHash === expected;
  const gates = evaluateApplyGates({
    apply: options.apply,
    confirmProductionClientImport: options.confirmProductionClientImport,
    envEnabled: options.envEnabled,
    target: options.target,
    fingerprintMatch,
  });
  if (!gates.ok) {
    return { ok: false, mode: "apply-rejected", reason: gates.reason };
  }

  const parsed = parseReconciliationWorkbook(buffer);
  const store = options.store ?? new InMemoryClientMemoryStore();
  return applyParsedWorkbook(parsed, {
    store,
    target: gates.target,
    implementationCommit: options.implementationCommit ?? null,
  });
}

export async function applyParsedWorkbook(
  parsed: ParsedWorkbook,
  input: {
    store: ClientMemoryStore;
    target: ApplyTarget;
    implementationCommit: string | null;
  },
): Promise<ApplySuccess> {
  const store = input.store;
  const now = new Date().toISOString();
  const personIdByImportKey = new Map<string, string>();
  const uniqueNameToPersonId = new Map<string, string>();
  const duplicateNames = new Set<string>();

  for (const [name, count] of parsed.peopleNameCounts) {
    if (count !== 1) duplicateNames.add(name);
  }

  let personsCreated = 0;
  let personsMatched = 0;
  let personsUnchanged = 0;
  let profilesPopulated = 0;
  let identitiesAttached = 0;
  let reviewsOpened = 0;
  let skippedNeedsReview = 0;
  let skippedOrganization = 0;
  let skippedUnsupportedPhone = 0;
  let skippedInvalidPeople = 0;
  let identityConflicts = 0;
  let profileConflicts = 0;

  for (const row of parsed.people) {
    const outcome = await applyPersonRow(store, row, {
      now,
      personIdByImportKey,
      uniqueNameToPersonId,
      duplicateNames,
    });
    personsCreated += outcome.personsCreated;
    personsMatched += outcome.personsMatched;
    personsUnchanged += outcome.personsUnchanged;
    profilesPopulated += outcome.profilesPopulated;
    identitiesAttached += outcome.identitiesAttached;
    reviewsOpened += outcome.reviewsOpened;
    skippedNeedsReview += outcome.skippedNeedsReview;
    skippedOrganization += outcome.skippedOrganization;
    skippedUnsupportedPhone += outcome.skippedUnsupportedPhone;
    skippedInvalidPeople += outcome.skippedInvalidPeople;
    identityConflicts += outcome.identityConflicts;
    profileConflicts += outcome.profileConflicts;
  }

  let sourceNotesInserted = 0;
  let sourceNotesAlreadyPresent = 0;
  let projectsCreated = 0;
  let projectHistoriesCreated = 0;
  let projectPersonLinks = 0;
  let projectsExactLinked = 0;
  let projectsReviewUnlinked = 0;
  let projectsUnresolved = 0;

  for (const row of parsed.projects) {
    if (row.matchJudgment === "no-exact") {
      projectsUnresolved += 1;
      continue;
    }

    const personId =
      row.matchJudgment === "exact" &&
      row.canonicalClient &&
      !duplicateNames.has(row.canonicalClient)
        ? (uniqueNameToPersonId.get(row.canonicalClient) ?? null)
        : null;

    if (row.matchJudgment === "exact" && personId) {
      const project = await createProjectBundle(store, row, now);
      if (project.created) {
        projectsCreated += 1;
        projectHistoriesCreated += 1;
      }
      const link = await store.insertRelationship({
        id: randomUUID(),
        fromEntityId: personId,
        toEntityId: project.projectId,
        kind: "client-project",
        status: "active",
        sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        createdAt: now,
        createdBy: CREATED_BY,
      });
      if (link.status === "inserted") projectPersonLinks += 1;
      projectsExactLinked += 1;
      const notes = await insertProjectNotes(
        store,
        row,
        personId,
        project.projectId,
        now,
      );
      sourceNotesInserted += notes.inserted;
      sourceNotesAlreadyPresent += notes.alreadyPresent;
      continue;
    }

    const project = await createProjectBundle(store, row, now);
    if (project.created) {
      projectsCreated += 1;
      projectHistoriesCreated += 1;
      reviewsOpened += await openReview(store, {
        reasonCode:
          row.matchJudgment === "malformed-source-value"
            ? "REVIEW_MALFORMED_PROJECT_MATCH"
            : row.matchJudgment === "exact"
              ? "REVIEW_EXACT_NAME_NOT_UNIQUE_OR_UNIMPORTED"
              : "REVIEW_PROJECT_PERSON_LINK",
        importRowKey: row.importRowKey,
        now,
      });
    }
    projectsReviewUnlinked += 1;
    const notes = await insertProjectNotes(
      store,
      row,
      null,
      project.projectId,
      now,
    );
    sourceNotesInserted += notes.inserted;
    sourceNotesAlreadyPresent += notes.alreadyPresent;
  }

  let reviewQueueImported = 0;
  for (const row of parsed.reviewQueue) {
    reviewQueueImported += await openReview(store, {
      reasonCode: "REVIEW_QUEUE_SEEDED",
      importRowKey: row.importRowKey,
      now,
      issueText: row.issue || null,
      resolutionText: row.recommendedResolution || null,
    });
  }

  void personIdByImportKey;

  return {
    ok: true,
    mode: "apply",
    target: input.target,
    schemaVersion: CLIENT_MEMORY_SCHEMA_VERSION,
    sourceArtifactVersion: AUDITED_RECONCILIATION_V3.sourceArtifactVersion,
    workbookFingerprintMatch: true,
    implementationCommit: input.implementationCommit,
    personsCreated,
    personsMatched,
    personsUnchanged,
    profilesPopulated,
    identitiesAttached,
    reviewsOpened,
    sourceNotesInserted,
    sourceNotesAlreadyPresent,
    projectsCreated,
    projectHistoriesCreated,
    projectPersonLinks,
    skippedNeedsReview,
    skippedOrganization,
    skippedUnsupportedPhone,
    skippedInvalidPeople,
    identityConflicts,
    profileConflicts,
    projectsExactLinked,
    projectsReviewUnlinked,
    projectsUnresolved,
    reviewQueueImported,
    vendorRowsSkipped: parsed.vloraRows,
  };
}

type PersonApplyDelta = {
  personsCreated: number;
  personsMatched: number;
  personsUnchanged: number;
  profilesPopulated: number;
  identitiesAttached: number;
  reviewsOpened: number;
  skippedNeedsReview: number;
  skippedOrganization: number;
  skippedUnsupportedPhone: number;
  skippedInvalidPeople: number;
  identityConflicts: number;
  profileConflicts: number;
};

async function applyPersonRow(
  store: ClientMemoryStore,
  row: ParsedPersonRow,
  ctx: {
    now: string;
    personIdByImportKey: Map<string, string>;
    uniqueNameToPersonId: Map<string, string>;
    duplicateNames: Set<string>;
  },
): Promise<PersonApplyDelta> {
  const zero: PersonApplyDelta = {
    personsCreated: 0,
    personsMatched: 0,
    personsUnchanged: 0,
    profilesPopulated: 0,
    identitiesAttached: 0,
    reviewsOpened: 0,
    skippedNeedsReview: 0,
    skippedOrganization: 0,
    skippedUnsupportedPhone: 0,
    skippedInvalidPeople: 0,
    identityConflicts: 0,
    profileConflicts: 0,
  };

  if (row.classification === "organization-candidate") {
    return { ...zero, skippedOrganization: 1 };
  }
  if (row.classification === "needs-review") {
    const opened = await openReview(store, {
      reasonCode: "PEOPLE_NEEDS_REVIEW",
      importRowKey: row.importRowKey,
      now: ctx.now,
    });
    return { ...zero, skippedNeedsReview: 1, reviewsOpened: opened };
  }
  if (row.classification !== "person-candidate") {
    const opened = await openReview(store, {
      reasonCode: "INVALID_PERSON_ROW",
      importRowKey: row.importRowKey,
      now: ctx.now,
    });
    return { ...zero, skippedInvalidPeople: 1, reviewsOpened: opened };
  }

  if (classifyPhone(row.phone).status === "international") {
    const opened = await openReview(store, {
      reasonCode: "REVIEW_UNSUPPORTED_PHONE",
      importRowKey: row.importRowKey,
      now: ctx.now,
    });
    return { ...zero, skippedUnsupportedPhone: 1, reviewsOpened: opened };
  }

  const claims = {
    email: row.email || null,
    phone: row.phone || null,
    importRowKey: row.importRowKey,
  };
  const prepared = prepareIdentityClaims(claims);
  const resolution = await resolvePersonIdentity(store, claims);

  if (prepared.malformed.length > 0 || resolution.status === "invalid") {
    const opened = await openReview(store, {
      reasonCode: resolution.reasonCode,
      importRowKey: row.importRowKey,
      now: ctx.now,
    });
    return { ...zero, skippedInvalidPeople: 1, reviewsOpened: opened };
  }
  if (resolution.status === "review") {
    const opened = await openReview(store, {
      reasonCode: resolution.reasonCode,
      importRowKey: row.importRowKey,
      now: ctx.now,
    });
    return { ...zero, identityConflicts: 1, reviewsOpened: opened };
  }

  const identities = prepared.claims.map((claim) => ({
    identityKind: claim.identityKind,
    identifier: claim.identifier,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: ctx.now,
  }));
  const names = splitDisplayName(row.name);
  const profilePatch = profileFromRow(row, names);

  if (resolution.status === "matched" && resolution.personId) {
    const applied = await store.applyExistingPersonAtomic({
      personId: resolution.personId,
      updatedAt: ctx.now,
      profile: profilePatch,
      identities,
    });
    if (applied.status === "conflict") {
      const opened = await openReview(store, {
        reasonCode:
          applied.reason === "profile_conflict"
            ? "REVIEW_PROFILE_CONFLICT"
            : "REVIEW_IDENTITY_COLLISION",
        importRowKey: row.importRowKey,
        now: ctx.now,
      });
      return {
        ...zero,
        identityConflicts: applied.reason === "identity_conflict" ? 1 : 0,
        profileConflicts: applied.reason === "profile_conflict" ? 1 : 0,
        reviewsOpened: opened,
      };
    }
    rememberPerson(ctx, row, resolution.personId);
    return {
      ...zero,
      personsMatched: 1,
      profilesPopulated: applied.populated ? 1 : 0,
      personsUnchanged: applied.populated ? 0 : 1,
      identitiesAttached: identities.length,
    };
  }

  const created = await store.createPersonAtomic({
    createdAt: ctx.now,
    createdBy: CREATED_BY,
    profile: {
      ...profilePatch,
      roles: [],
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: ctx.now,
      updatedAt: ctx.now,
    },
    identities,
  });
  rememberPerson(ctx, row, created.personId);
  return {
    ...zero,
    personsCreated: 1,
    identitiesAttached: identities.length,
  };
}

function profileFromRow(
  row: ParsedPersonRow,
  names: { givenName: string | null; familyName: string | null },
): Pick<
  PersonProfile,
  | "displayName"
  | "givenName"
  | "familyName"
  | "organizationName"
  | "email"
  | "phone"
  | "streetAddress"
  | "city"
  | "state"
  | "country"
  | "postalCode"
> {
  return {
    displayName: row.name,
    givenName: names.givenName,
    familyName: names.familyName,
    organizationName: row.companyName || null,
    email: row.email || null,
    phone: row.phone || null,
    streetAddress: row.streetAddress || null,
    city: row.city || null,
    state: row.state || null,
    country: row.country || null,
    postalCode: row.postalCode || null,
  };
}

function rememberPerson(
  ctx: {
    personIdByImportKey: Map<string, string>;
    uniqueNameToPersonId: Map<string, string>;
    duplicateNames: Set<string>;
  },
  row: ParsedPersonRow,
  personId: string,
): void {
  ctx.personIdByImportKey.set(row.importRowKey, personId);
  if (row.name && !ctx.duplicateNames.has(row.name)) {
    ctx.uniqueNameToPersonId.set(row.name, personId);
  }
}

async function createProjectBundle(
  store: ClientMemoryStore,
  row: ParsedProjectRow,
  now: string,
): Promise<{ projectId: string; created: boolean }> {
  const existing = await store.findProjectByImportRowKey({
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    importRowKey: row.importRowKey,
  });
  if (existing) return { projectId: existing.projectId, created: false };
  const entity = await store.insertEntity({
    kind: "project",
    createdAt: now,
    createdBy: CREATED_BY,
  });
  const projectId = entity.record.id;
  await store.insertProjectProfile({
    projectId,
    displayTitle: row.displayTitle || `project:${row.importRowKey}`,
    visibility: DEFAULT_VISIBILITY,
    importRowKey: row.importRowKey,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: now,
    updatedAt: now,
  });
  const history: ProjectHistory = {
    projectId,
    cadJobNumber: row.cadJobNumber || null,
    orderNumber: row.orderNumber || null,
    gmailThreadId:
      row.gmailThread.status === "canonical" ? row.gmailThread.value : null,
    matchJudgment:
      row.matchJudgment === "malformed-source-value" ? null : row.matchJudgment,
    matchJudgmentRaw: row.clientDbMatchRaw || null,
    fingerSize: scalarText(row.fingerSize),
    metal: scalarText(row.metal),
    centerStone: scalarText(row.centerStone),
    diamondSupplyNotes: scalarText(row.supplyNotes),
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: now,
    updatedAt: now,
  };
  await store.insertProjectHistory(history);
  if (row.gmailThread.status === "invalid") {
    await openReview(store, {
      reasonCode: "REVIEW_INVALID_GMAIL_THREAD_ID",
      importRowKey: row.importRowKey,
      now,
    });
    await store.insertSourceNote({
      id: randomUUID(),
      personId: null,
      projectId,
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      sourceArtifact: AUDITED_RECONCILIATION_V3.artifactId,
      sourceSheet: "Reconciled Projects",
      sourceField: "Gmail Thread ID",
      importRowKey: row.importRowKey,
      gmailThreadId: null,
      noteText: row.gmailThread.source,
      createdAt: now,
    });
  }
  return { projectId, created: true };
}

async function insertProjectNotes(
  store: ClientMemoryStore,
  row: ParsedProjectRow,
  personId: string | null,
  projectId: string,
  now: string,
): Promise<{ inserted: number; alreadyPresent: number }> {
  let inserted = 0;
  let alreadyPresent = 0;
  const writes: Array<{ field: string; text: string }> = [];
  if (isProseCandidate(row.notes)) {
    writes.push({ field: "Notes", text: cellText(row.notes) });
  }
  if (row.reviewFlagProse) {
    writes.push({ field: "Review Flag", text: row.reviewFlagProse });
  }
  for (const write of writes) {
    const result = await store.insertSourceNote({
      id: randomUUID(),
      personId,
      projectId,
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      sourceArtifact: AUDITED_RECONCILIATION_V3.artifactId,
      sourceSheet: "Reconciled Projects",
      sourceField: write.field,
      importRowKey: row.importRowKey,
      gmailThreadId:
        row.gmailThread.status === "canonical" ? row.gmailThread.value : null,
      noteText: write.text,
      createdAt: now,
    });
    if (result.status === "inserted") inserted += 1;
    else alreadyPresent += 1;
  }
  return { inserted, alreadyPresent };
}

async function openReview(
  store: ClientMemoryStore,
  input: {
    reasonCode: string;
    importRowKey: string;
    now: string;
    issueText?: string | null;
    resolutionText?: string | null;
  },
): Promise<0 | 1> {
  const result = await store.insertIdentityReview({
    id: randomUUID(),
    status: "open",
    reasonCode: input.reasonCode,
    leftPersonId: null,
    rightPersonId: null,
    importRowKey: input.importRowKey,
    issueText: input.issueText ?? null,
    resolutionText: input.resolutionText ?? null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: input.now,
  });
  return result.status === "inserted" ? 1 : 0;
}

function scalarText(value: CellScalar): string | null {
  const text = cellText(value);
  return text ? text : null;
}
