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
import { newSourceNoteLifecycle } from "./source-note-row";
import { evaluatePersonRow, type PersonRowEvaluation } from "./eligibility";
import { evaluateApplyGates, type ApplyTarget } from "./gates";
import {
  buildWorkbookSidePlan,
  dedupeReviews,
  type ClientMemoryImportManifest,
  type PlannedReview,
} from "./plan";
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
  identityWarnings: number;
  profileConflicts: number;
  projectsExactLinked: number;
  projectsReviewUnlinked: number;
  projectsUnresolved: number;
  reviewQueueImported: number;
  vendorRowsSkipped: number;
  factsCreated: number;
  wishesCreated: number;
  manifest: ClientMemoryImportManifest;
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
  let skippedNeedsReview = 0;
  let skippedOrganization = 0;
  let skippedInvalidPeople = 0;
  let identityConflicts = 0;
  let identityWarnings = 0;
  let profileConflicts = 0;

  const people: Array<{ row: ParsedPersonRow; evaluation: PersonRowEvaluation }> =
    [];
  const applyTimeReviews: PlannedReview[] = [];

  for (const row of parsed.people) {
    const evaluation = await evaluatePersonRow(store, row);
    people.push({ row, evaluation });
    identityWarnings += evaluation.identityWarnings.length;
    const outcome = await applyPersonRow(store, row, evaluation, {
      now,
      personIdByImportKey,
      uniqueNameToPersonId,
      duplicateNames,
      applyTimeReviews,
    });
    personsCreated += outcome.personsCreated;
    personsMatched += outcome.personsMatched;
    personsUnchanged += outcome.personsUnchanged;
    profilesPopulated += outcome.profilesPopulated;
    identitiesAttached += outcome.identitiesAttached;
    skippedNeedsReview += outcome.skippedNeedsReview;
    skippedOrganization += outcome.skippedOrganization;
    skippedInvalidPeople += outcome.skippedInvalidPeople;
    identityConflicts += outcome.identityConflicts;
    profileConflicts += outcome.profileConflicts;
  }

  const side = buildWorkbookSidePlan(
    parsed,
    people,
    new Set(uniqueNameToPersonId.keys()),
  );
  const projectIdByImportKey = new Map<string, string>();

  let sourceNotesInserted = 0;
  let sourceNotesAlreadyPresent = 0;
  let projectsCreated = 0;
  let projectHistoriesCreated = 0;
  let projectPersonLinks = 0;
  let projectsExactLinked = 0;
  let projectsReviewUnlinked = 0;
  let projectsUnresolved = 0;

  for (const planned of side.projects) {
    const row = planned.row;
    if (planned.action === "unresolved") {
      projectsUnresolved += 1;
      continue;
    }

    const personId =
      planned.action === "exact-link"
        ? (uniqueNameToPersonId.get(row.canonicalClient) ?? null)
        : null;

    const project = await createProjectBundle(store, row, now);
    projectIdByImportKey.set(row.importRowKey, project.projectId);
    if (project.created) {
      projectsCreated += 1;
      projectHistoriesCreated += 1;
    }

    if (planned.action === "exact-link" && personId) {
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
    } else {
      projectsReviewUnlinked += 1;
    }
  }

  for (const note of side.notes) {
    const projectId = projectIdByImportKey.get(note.importRowKey);
    if (!projectId) continue;
    const projectRow = parsed.projects.find(
      (row) => row.importRowKey === note.importRowKey,
    );
    const personId =
      projectRow && uniqueNameToPersonId.has(projectRow.canonicalClient)
        ? (uniqueNameToPersonId.get(projectRow.canonicalClient) ?? null)
        : null;
    const result = await store.insertSourceNote({
      id: randomUUID(),
      personId: note.sourceField === "Gmail Thread ID" ? null : personId,
      projectId,
      contextLayer: "client",
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      sourceArtifact: AUDITED_RECONCILIATION_V3.artifactId,
      sourceSheet: note.sourceSheet,
      sourceField: note.sourceField,
      importRowKey: note.importRowKey,
      gmailThreadId:
        projectRow?.gmailThread.status === "canonical"
          ? projectRow.gmailThread.value
          : null,
      noteText: note.text,
      createdAt: now,
      ...newSourceNoteLifecycle({
        sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
        createdAt: now,
        lifecycleStatus: "absorbed",
      }),
    });
    if (result.status === "inserted") sourceNotesInserted += 1;
    else sourceNotesAlreadyPresent += 1;
  }

  let reviewsOpened = 0;
  let reviewQueueImported = 0;
  const reviewsToOpen = dedupeReviews([...side.reviews, ...applyTimeReviews]);
  for (const review of reviewsToOpen) {
    const opened = await openReview(store, {
      ...review,
      now,
    });
    reviewsOpened += opened;
    if (review.reasonCode === "REVIEW_QUEUE_SEEDED") {
      reviewQueueImported += opened;
    }
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
    skippedUnsupportedPhone: 0,
    skippedInvalidPeople,
    identityConflicts,
    identityWarnings,
    profileConflicts,
    projectsExactLinked,
    projectsReviewUnlinked,
    projectsUnresolved,
    reviewQueueImported,
    vendorRowsSkipped: parsed.vloraRows,
    factsCreated: 0,
    wishesCreated: 0,
    manifest: side.manifest,
  };
}

type PersonApplyDelta = {
  personsCreated: number;
  personsMatched: number;
  personsUnchanged: number;
  profilesPopulated: number;
  identitiesAttached: number;
  skippedNeedsReview: number;
  skippedOrganization: number;
  skippedInvalidPeople: number;
  identityConflicts: number;
  profileConflicts: number;
};

async function applyPersonRow(
  store: ClientMemoryStore,
  row: ParsedPersonRow,
  evaluation: PersonRowEvaluation,
  ctx: {
    now: string;
    personIdByImportKey: Map<string, string>;
    uniqueNameToPersonId: Map<string, string>;
    duplicateNames: Set<string>;
    applyTimeReviews: PlannedReview[];
  },
): Promise<PersonApplyDelta> {
  const zero: PersonApplyDelta = {
    personsCreated: 0,
    personsMatched: 0,
    personsUnchanged: 0,
    profilesPopulated: 0,
    identitiesAttached: 0,
    skippedNeedsReview: 0,
    skippedOrganization: 0,
    skippedInvalidPeople: 0,
    identityConflicts: 0,
    profileConflicts: 0,
  };

  if (evaluation.eligibility === "organization") {
    return { ...zero, skippedOrganization: 1 };
  }
  if (evaluation.eligibility === "needs-review") {
    return { ...zero, skippedNeedsReview: 1 };
  }
  if (evaluation.eligibility === "invalid") {
    return { ...zero, skippedInvalidPeople: 1 };
  }
  if (evaluation.eligibility === "identity-conflict") {
    return { ...zero, identityConflicts: 1 };
  }

  const identities = evaluation.validIdentityClaims.map((claim) => ({
    identityKind: claim.identityKind,
    identifier: claim.identifier,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: ctx.now,
  }));
  const names = splitDisplayName(row.name);
  const profilePatch = profileFromRow(row, names);

  if (evaluation.mutation === "match" && evaluation.personId) {
    const applied = await store.applyExistingPersonAtomic({
      personId: evaluation.personId,
      updatedAt: ctx.now,
      profile: profilePatch,
      roles: evaluation.roles,
      identities,
    });
    if (applied.status === "conflict") {
      ctx.applyTimeReviews.push({
        importRowKey: row.importRowKey,
        reasonCode:
          applied.reason === "profile_conflict"
            ? "REVIEW_PROFILE_CONFLICT"
            : "REVIEW_IDENTITY_COLLISION",
      });
      return {
        ...zero,
        identityConflicts: applied.reason === "identity_conflict" ? 1 : 0,
        profileConflicts: applied.reason === "profile_conflict" ? 1 : 0,
      };
    }
    rememberPerson(ctx, row, evaluation.personId);
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
      roles: evaluation.roles,
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: ctx.now,
      updatedAt: ctx.now,
    },
    identities,
  });
  rememberPerson(ctx, row, created.personId);
  return {
    ...zero,
    personsCreated: created.status === "already-present" ? 0 : 1,
    personsMatched: created.status === "already-present" ? 1 : 0,
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

function historyFromParsedRow(
  projectId: string,
  row: ParsedProjectRow,
  now: string,
): ProjectHistory {
  return {
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
  if (existing) {
    // Replay stays skip-on-existing. applyImportedProjectHistory is the
    // field-level guard if a later import path writes current specs.
    return { projectId: existing.projectId, created: false };
  }
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
  await store.insertProjectHistory(historyFromParsedRow(projectId, row, now));
  return { projectId, created: true };
}

async function openReview(
  store: ClientMemoryStore,
  input: PlannedReview & { now: string },
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
