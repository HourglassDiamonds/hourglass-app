export const REAL_CLIENT_COHORT = [
  { key: "morgan", label: "Morgan", token: "morgan" },
  { key: "audrey", label: "Audrey", token: "audrey" },
  { key: "daniel", label: "Daniel", token: "daniel" },
  { key: "pennock", label: "J. Pennock", token: "pennock" },
  { key: "zane", label: "Zane", token: "zane" },
  { key: "dylan", label: "Dylan", token: "dylan" },
  { key: "madi", label: "Madi", token: "madi" },
  { key: "jp", label: "JP", token: "jp" },
] as const;

export type RealClientCohortKey = (typeof REAL_CLIENT_COHORT)[number]["key"];

export type AssociationMessage = {
  messageId: string;
  threadId: string;
  subject: string;
  sentAt: string;
  indexedAt: string;
  direction: "inbound" | "outbound" | "unknown";
  participantHashes: readonly string[];
};

export type AssociationPerson = {
  personId: string;
  label: string;
  emailHash: string | null;
  sourceSystem: string;
};

export type AssociationProject = {
  projectId: string;
  label: string;
  sourceSystem: string;
};

export type AssociationJob = {
  jobId: string;
  projectId: string | null;
  label: string;
  state: string;
  waitingOn: string;
  sourceSystem: string;
};

export type AssociationRelationship = {
  personId: string;
  projectId: string;
};

export type RealClientThreadReview = {
  threadId: string;
  messageCount: number;
  earliestAt: string;
  latestAt: string;
  latestInboundAt: string | null;
  latestOutboundAt: string | null;
  latestDirection: AssociationMessage["direction"];
  plausibleNextOwner: "founder" | "client" | "unknown";
  identityEvidence: "exact-canonical-email" | "subject-discovery-only";
  target: {
    personId: string;
    personLabel: string;
    projectId: string;
    projectLabel: string;
    jobId: string | null;
    jobLabel: string | null;
  } | null;
  fixtureTargetsExcluded: readonly string[];
  founderConfirmationRequired: boolean;
  recommendedDecision: "confirm" | "leave-unresolved";
  conflict: string | null;
};

export type RealClientAssociationReview = {
  key: RealClientCohortKey;
  label: string;
  currentProviderThreads: readonly RealClientThreadReview[];
  fixtureEraThreadIds: readonly string[];
  status: "confirmable" | "founder-review-required" | "no-current-evidence";
};

export type RealClientAssociationBatch = {
  generatedAt: string;
  authorizationAt: string | null;
  indexedMessageCount: number;
  indexedThreadCount: number;
  currentProviderThreadCount: number;
  trustedCurrentProviderThreadCount: number;
  unresolvedCurrentProviderThreadCount: number;
  associationPersistence: "available" | "missing" | "unavailable";
  allIndexedThreadIds: readonly string[];
  postAuthorizationThreadIds: readonly string[];
  currentProviderThreadIds: readonly string[];
  reviews: readonly RealClientAssociationReview[];
};

function normalizedWords(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export function cohortForSubject(subject: string): RealClientCohortKey[] {
  const words = new Set(normalizedWords(subject));
  return REAL_CLIENT_COHORT.filter((row) => words.has(row.token)).map((row) => row.key);
}

export function isFixtureAssociationSource(sourceSystem: string, label = ""): boolean {
  const source = sourceSystem.toLowerCase();
  const name = label.toLowerCase();
  return (
    source.includes("preview") ||
    source.includes("acceptance") ||
    name.includes("preview_test") ||
    name.includes("preview client") ||
    name.includes("test client") ||
    name.includes("sterling acceptance sandbox")
  );
}

function latest(values: readonly string[]): string | null {
  return values.filter(Boolean).sort().at(-1) ?? null;
}

function buildThread(input: {
  messages: readonly AssociationMessage[];
  people: readonly AssociationPerson[];
  projects: readonly AssociationProject[];
  jobs: readonly AssociationJob[];
  relationships: readonly AssociationRelationship[];
}): RealClientThreadReview {
  const ordered = [...input.messages].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const newest = ordered.at(-1)!;
  const participantHashes = new Set(ordered.flatMap((row) => row.participantHashes));
  const realPeople = input.people.filter((row) => !isFixtureAssociationSource(row.sourceSystem, row.label));
  const exactPeople = realPeople.filter((row) => row.emailHash && participantHashes.has(row.emailHash));
  const exactProjects = exactPeople.flatMap((person) =>
    input.relationships
      .filter((row) => row.personId === person.personId)
      .map((row) => ({ person, project: input.projects.find((project) => project.projectId === row.projectId) }))
      .filter((row): row is { person: AssociationPerson; project: AssociationProject } =>
        Boolean(row.project && !isFixtureAssociationSource(row.project.sourceSystem, row.project.label)),
      ),
  );
  const fixtureTargetsExcluded = input.projects
    .filter((row) => isFixtureAssociationSource(row.sourceSystem, row.label))
    .filter((row) => cohortForSubject(row.label).some((key) => cohortForSubject(newest.subject).includes(key)))
    .map((row) => row.label);
  const uniqueTargets = new Map(exactProjects.map((row) => [row.project.projectId, row]));
  const sole = uniqueTargets.size === 1 ? [...uniqueTargets.values()][0] : null;
  const openJobs = sole
    ? input.jobs.filter((row) => row.projectId === sole.project.projectId && row.state === "open" && !isFixtureAssociationSource(row.sourceSystem, row.label))
    : [];
  const target = sole
    ? {
        personId: sole.person.personId,
        personLabel: sole.person.label,
        projectId: sole.project.projectId,
        projectLabel: sole.project.label,
        jobId: openJobs.length === 1 ? openJobs[0].jobId : null,
        jobLabel: openJobs.length === 1 ? openJobs[0].label : null,
      }
    : null;
  const latestInboundAt = latest(ordered.filter((row) => row.direction === "inbound").map((row) => row.sentAt));
  const latestOutboundAt = latest(ordered.filter((row) => row.direction === "outbound").map((row) => row.sentAt));
  const conflict = exactPeople.length > 1
    ? "More than one canonical person has an exact participant match."
    : uniqueTargets.size > 1
      ? "The exact person match is linked to more than one current project."
      : target && openJobs.length > 1
        ? "The project has more than one open Job; Job ownership remains unresolved."
        : null;
  const confirmable = Boolean(target && !conflict);
  return {
    threadId: newest.threadId,
    messageCount: ordered.length,
    earliestAt: ordered[0].sentAt,
    latestAt: newest.sentAt,
    latestInboundAt,
    latestOutboundAt,
    latestDirection: newest.direction,
    plausibleNextOwner: newest.direction === "inbound" ? "founder" : newest.direction === "outbound" ? "client" : "unknown",
    identityEvidence: exactPeople.length === 1 ? "exact-canonical-email" : "subject-discovery-only",
    target,
    fixtureTargetsExcluded,
    founderConfirmationRequired: true,
    recommendedDecision: confirmable ? "confirm" : "leave-unresolved",
    conflict,
  };
}

export function buildRealClientAssociationBatch(input: {
  messages: readonly AssociationMessage[];
  people: readonly AssociationPerson[];
  projects: readonly AssociationProject[];
  jobs: readonly AssociationJob[];
  relationships: readonly AssociationRelationship[];
  authorizationAt: string | null;
  trustedThreadIds?: readonly string[];
  associationPersistence: RealClientAssociationBatch["associationPersistence"];
  nowIso: string;
}): RealClientAssociationBatch {
  const authorizationMs = Date.parse(input.authorizationAt ?? "");
  const postAuthorization = (row: AssociationMessage) =>
    Number.isFinite(authorizationMs) && Date.parse(row.indexedAt) > authorizationMs;
  const trusted = new Set(input.trustedThreadIds ?? []);
  const reviews = REAL_CLIENT_COHORT.map((cohort) => {
    const matching = input.messages.filter((row) => cohortForSubject(row.subject).includes(cohort.key));
    const fixtureEraThreadIds = [...new Set(matching.filter((row) => !postAuthorization(row)).map((row) => row.threadId))];
    const current = matching.filter(postAuthorization);
    const byThread = new Map<string, AssociationMessage[]>();
    for (const row of current) {
      const bucket = byThread.get(row.threadId) ?? [];
      bucket.push(row);
      byThread.set(row.threadId, bucket);
    }
    const currentProviderThreads = [...byThread.values()]
      .map((messages) => buildThread({ ...input, messages }))
      .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
    return {
      key: cohort.key,
      label: cohort.label,
      currentProviderThreads,
      fixtureEraThreadIds,
      status: currentProviderThreads.length === 0
        ? "no-current-evidence" as const
        : currentProviderThreads.some((row) => row.recommendedDecision === "confirm")
          ? "confirmable" as const
          : "founder-review-required" as const,
    };
  });
  const currentProviderThreadIds = [...new Set(reviews.flatMap((row) => row.currentProviderThreads.map((thread) => thread.threadId)))];
  const allIndexedThreadIds = [...new Set(input.messages.map((row) => row.threadId))];
  const postAuthorizationThreadIds = [...new Set(input.messages.filter(postAuthorization).map((row) => row.threadId))];
  const trustedCurrentProviderThreadCount = currentProviderThreadIds.filter((id) => trusted.has(id)).length;
  return {
    generatedAt: input.nowIso,
    authorizationAt: input.authorizationAt,
    indexedMessageCount: input.messages.length,
    indexedThreadCount: allIndexedThreadIds.length,
    currentProviderThreadCount: currentProviderThreadIds.length,
    trustedCurrentProviderThreadCount,
    unresolvedCurrentProviderThreadCount: currentProviderThreadIds.length - trustedCurrentProviderThreadCount,
    associationPersistence: input.associationPersistence,
    allIndexedThreadIds,
    postAuthorizationThreadIds,
    currentProviderThreadIds,
    reviews,
  };
}
