import { createHash } from "node:crypto";

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

export type AssociationAttachment = {
  messageId: string;
  threadId: string;
  filename: string;
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
  lifecycleStage?: string | null;
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

export type ReviewedAssociation = {
  id: string;
  projectId: string;
  threadId: string;
  status: "trusted" | "rejected";
  updatedAt: string;
};

export type RealClientThreadReview = {
  threadId: string;
  messageCount: number;
  earliestAt: string;
  latestAt: string;
  latestInboundAt: string | null;
  latestOutboundAt: string | null;
  latestDirection: AssociationMessage["direction"];
  sourceAttachmentIdentifiers: readonly string[];
  plausibleNextOwner: "founder" | "client" | "unknown";
  identityEvidence: "exact-canonical-email" | "subject-discovery-only";
  target: {
    personId: string;
    personLabel: string;
    projectId: string;
    projectLabel: string;
    jobId: string | null;
    jobLabel: string | null;
    lifecycleStage: string | null;
    openJobs: readonly {
      jobId: string;
      label: string;
      state: string;
      waitingOn: string;
    }[];
    reviewKey: string;
    currentDecision: "trusted" | "rejected" | null;
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
  founderPacket: FounderReviewPacket | null;
};

export type FounderReviewPacket = {
  primaryThreadId: string;
  supportingThreadIds: readonly string[];
  verifiedEvidence: readonly string[];
  founderSuppliedContext: readonly string[];
  ownershipAssessment: string;
  unresolvedDecisions: readonly string[];
  proposedChangesAfterApproval: readonly string[];
  safeguards: readonly string[];
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

function founderPacketFor(
  key: RealClientCohortKey,
  threads: readonly RealClientThreadReview[],
): FounderReviewPacket | null {
  const available = new Set(threads.map((thread) => thread.threadId));
  if (key === "zane" && available.has("1a1212396a8ac111")) return {
    primaryThreadId: "1a1212396a8ac111",
    supportingThreadIds: [],
    verifiedEvidence: [
      "Six indexed messages in the direct Zane wedding-band thread.",
      "The provider participant is Zane Kennedy at zanemkennedy88@gmail.com; no non-fixture canonical Person or Project currently uses that identity.",
      "Latest client inbound: October 13 at 16:56:38 UTC; latest founder outbound: October 13 at 17:02:40 UTC.",
      "The founder replied after Zane's latest indexed message, so no email-reply obligation is supported.",
    ],
    founderSuppliedContext: [
      "Founder-confirmed operational fact · November 6: this exact real Zane Kennedy wedding-band workflow is In Production.",
      "The founder's October 13 message promised a phone call, but the founder has not confirmed that the call occurred.",
    ],
    ownershipAssessment: "Correspondence is founder-answered. The Project is in Production by founder authority; no email-reply or completed-call claim is supported.",
    unresolvedDecisions: [
      "Approve or reject the exact canonical write set for Zane Kennedy and his wedding-band Project.",
      "Approve or reject trusting provider thread 1a1212396a8ac111 exclusively to that Project.",
    ],
    proposedChangesAfterApproval: [
      "Person: Zane Kennedy · client · zanemkennedy88@gmail.com · source concierge-manual.",
      "Project: Zane Kennedy — Wedding Band · custom_new_jewelry · internal-only · active client-project relationship · lifecycle production.",
      "Jobs: none. Do not create a reply task or mark the promised call complete.",
      "Trusted Gmail association: thread 1a1212396a8ac111 → the approved Zane Project only; target Job null.",
    ],
    safeguards: ["Exclude the synthetic Zane fixture. Founder confirmation supplies lifecycle truth; provider chronology supplies response truth, not proof that the call occurred."],
  };
  if (key === "audrey" && available.has("1a0d00fedde6906a")) return {
    primaryThreadId: "1a0d00fedde6906a",
    supportingThreadIds: available.has("1a0cf8910f00606f") ? ["1a0cf8910f00606f"] : [],
    verifiedEvidence: [
      "Twelve indexed messages in the vendor CAD/pricing thread, plus one earlier founder outbound discovery thread.",
      "Latest founder outbound: October 7 at 20:20:31 UTC; latest vendor inbound: October 8 at 15:07:39 UTC.",
      "Attachments reference C026401 and modified CAD images; this is discovery evidence, not canonical identity proof.",
    ],
    founderSuppliedContext: [],
    ownershipAssessment: "The latest indexed message is vendor inbound. A founder CAD/pricing decision may be due, but no client-reply obligation is established.",
    unresolvedDecisions: [
      "Confirm Audrey's exact real Person and Project identities.",
      "Confirm whether vendor thread 1a0d00fedde6906a belongs exclusively to that Project.",
      "Confirm the actual CAD/pricing decision and whether C026401 may be recorded as a Project CAD identifier.",
    ],
    proposedChangesAfterApproval: [
      "Create or link the approved non-fixture Person and Project.",
      "Trust only the confirmed vendor thread and create only the founder-owned CAD/pricing action the founder approves.",
    ],
    safeguards: ["Do not infer Audrey's identity or Project solely from vendor identifier C026401."],
  };
  if (key === "pennock" && available.has("1a08d1c1443a8ede")) return {
    primaryThreadId: "1a08d1c1443a8ede",
    supportingThreadIds: available.has("1a10c5b8e4a52db7") ? ["1a10c5b8e4a52db7"] : [],
    verifiedEvidence: [
      "Four indexed messages in the dedicated vendor thread for J. Pennock / C025519 / RN08286.",
      "The dedicated thread's latest message is vendor inbound on September 24 at 21:56:22 UTC.",
      "Live provider evidence resolves J. Pennock to John Pennock at pennock3@gmail.com; direct client thread 19fdca18f516310d discusses the sapphire ring, and QuickBooks records show paid invoices 1211 and 1232 for the same client.",
      "C025519 is evidenced as Vlora's CAD/design identifier. RN08286 is evidenced as Vlora's workshop job identifier. Neither is a canonical Person identity or Continuum Project number.",
      "A separate two-message status thread mixes Tim/Jenn C025964 with J. Pennock C025519; it is not safe as an exclusive Pennock association.",
    ],
    founderSuppliedContext: [
      "Founder-confirmed operational fact · November 6: John Pennock's sapphire/platinum ring was delivered and the Project is closed.",
      "Historical production and shipment evidence remains provenance only; it does not create a new shipping, delivery, or production obligation.",
    ],
    ownershipAssessment: "No active shipping, delivery, production, or client-reply obligation remains. The supported custom-jewelry lifecycle is completed.",
    unresolvedDecisions: [
      "Approve or reject the exact canonical write set for John Pennock and the sapphire/platinum ring Project, kept separate from JP.",
      "Choose whether to index the verified direct client thread before association approval; the currently indexed dedicated vendor thread does not contain John's canonical email participant.",
    ],
    proposedChangesAfterApproval: [
      "Person: John Pennock · client · pennock3@gmail.com · source concierge-manual. Preserve the provider-stated alias John Harold as provenance, not as a second Person.",
      "Project: John Pennock — Sapphire / Platinum Ring · custom_new_jewelry · internal-only · active client-project relationship · lifecycle completed.",
      "Jobs: none. Do not create or revive shipping, delivery, production, or reply work.",
      "Association after indexed participant validation: direct client thread 19fdca18f516310d → the approved Pennock Project only; target Job null.",
      "Keep vendor history threads 19fd370bc47c5e1f and 1a08d1c1443a8ede as supporting provenance; do not exclusively trust mixed thread 1a10c5b8e4a52db7.",
    ],
    safeguards: [
      "Exclude the synthetic Pennock fixture, keep J. Pennock separate from JP, and never use C025519 or RN08286 as Person identity proof or a Continuum Project number.",
    ],
  };
  return null;
}

function attachmentIdentifiers(
  threadId: string,
  attachments: readonly AssociationAttachment[],
): string[] {
  return [...new Set(
    attachments
      .filter((row) => row.threadId === threadId)
      .flatMap((row) => row.filename.match(/\bC\d{6}\b/gi) ?? [])
      .map((value) => value.toUpperCase()),
  )].sort();
}

function buildThread(input: {
  messages: readonly AssociationMessage[];
  attachments: readonly AssociationAttachment[];
  people: readonly AssociationPerson[];
  projects: readonly AssociationProject[];
  jobs: readonly AssociationJob[];
  relationships: readonly AssociationRelationship[];
  reviewedAssociations: readonly ReviewedAssociation[];
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
    ? (() => {
        const current = input.reviewedAssociations.find(
          (row) => row.threadId === newest.threadId && row.projectId === sole.project.projectId,
        ) ?? null;
        return {
        personId: sole.person.personId,
        personLabel: sole.person.label,
        projectId: sole.project.projectId,
        projectLabel: sole.project.label,
        jobId: openJobs.length === 1 ? openJobs[0].jobId : null,
        jobLabel: openJobs.length === 1 ? openJobs[0].label : null,
        lifecycleStage: sole.project.lifecycleStage ?? null,
        openJobs: openJobs.map((job) => ({
          jobId: job.jobId,
          label: job.label,
          state: job.state,
          waitingOn: job.waitingOn,
        })),
        reviewKey: founderAssociationReviewKey({
          threadId: newest.threadId,
          personId: sole.person.personId,
          projectId: sole.project.projectId,
          jobId: openJobs.length === 1 ? openJobs[0].jobId : null,
          current,
        }),
        currentDecision: current?.status ?? null,
      };
      })()
    : null;
  const latestInboundAt = latest(ordered.filter((row) => row.direction === "inbound").map((row) => row.sentAt));
  const latestOutboundAt = latest(ordered.filter((row) => row.direction === "outbound").map((row) => row.sentAt));
  const conflict = exactPeople.length > 1
    ? "More than one canonical person has an exact participant match."
    : uniqueTargets.size > 1
      ? "The exact person match is linked to more than one current project."
      : target && input.reviewedAssociations.some(
          (row) => row.threadId === newest.threadId && row.status === "trusted" && row.projectId !== target.projectId,
        )
          ? "This provider thread is already trusted by another project."
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
    sourceAttachmentIdentifiers: attachmentIdentifiers(newest.threadId, input.attachments),
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
  attachments?: readonly AssociationAttachment[];
  people: readonly AssociationPerson[];
  projects: readonly AssociationProject[];
  jobs: readonly AssociationJob[];
  relationships: readonly AssociationRelationship[];
  reviewedAssociations?: readonly ReviewedAssociation[];
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
      .map((messages) => buildThread({
        ...input,
        attachments: input.attachments ?? [],
        reviewedAssociations: input.reviewedAssociations ?? [],
        messages,
      }))
      .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
    return {
      key: cohort.key,
      label: cohort.label,
      currentProviderThreads,
      fixtureEraThreadIds,
      founderPacket: founderPacketFor(cohort.key, currentProviderThreads),
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

export function founderAssociationReviewKey(input: {
  threadId: string;
  personId: string;
  projectId: string;
  jobId: string | null;
  current: ReviewedAssociation | null;
}): string {
  const state = input.current ? `${input.current.status}:${input.current.updatedAt}` : "absent";
  return createHash("sha256")
    .update([
      "continuum-founder-association:v1",
      input.threadId,
      input.personId,
      input.projectId,
      input.jobId ?? "",
      state,
    ].join("\0"))
    .digest("hex");
}
