/**
 * Isolated Travis fixture world for Concierge tests and Sol proof.
 * Canonical finger size 12.5. Pending unverified proposal 11.
 */

import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { BirthdayRead } from "@/lib/continuum/client-memory/facts/types";
import type { CurrentProjectCard } from "@/lib/continuum/client-memory/open-projects/card";
import type { CurrentProjectOperatingGroup } from "@/lib/continuum/client-memory/open-projects/operating-groups";
import type {
  ProjectDeskGetResult,
  ProjectDeskRead,
  ProjectDeskSummary,
} from "@/lib/continuum/client-memory/project-desk/types";
import type {
  ClientSearchResult,
  ConciergePersonProfileResult,
} from "@/lib/continuum/client-memory/read/types";
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import type { ConciergeSolWorld } from "./world";

export const TRAVIS_PERSON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const TRAVIS_PROJECT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const TRAVIS_THREAD_ID = "18c9f0a1b2c3d4e5";

function card(title: string, extra?: Partial<CurrentProjectCard>): CurrentProjectCard {
  return {
    projectId: TRAVIS_PROJECT_ID,
    title,
    href: `/executive-dashboard/concierge/projects/${TRAVIS_PROJECT_ID}`,
    collapsedLine: "YOUR TURN — Send CAD",
    collapsedLineKind: "ownership",
    currentAction: { label: "YOUR TURN", detail: "Send CAD", source: "ownership" },
    currentJobId: null,
    snapshot: [],
    latestFile: null,
    files: [],
    fileCount: 0,
    progress: [],
    lifecycleStage: "cad",
    founderOwnedUnresolved: true,
    actionDueAt: null,
    waitingSince: null,
    updatedAt: null,
    ...extra,
  };
}

function travisCandidate(): ContinuumCandidate {
  return {
    candidateId: "cand-size-11",
    sourceSystem: "gmail",
    sourceRef: "gc1|not-verified",
    sourceTimestamp: "2026-08-01T12:00:00.000Z",
    candidateType: "structured_spec",
    proposedTarget: {
      kind: "project_spec",
      projectId: TRAVIS_PROJECT_ID,
      fieldName: "finger_size",
    },
    payload: {
      kind: "structured_spec",
      fieldName: "finger_size",
      proposedValue: "11",
      currentValue: "12.5",
      conflict: true,
      sourceProvenance: "UNKNOWN",
    },
    confidence: "medium",
    evidenceBasis: { ruleIds: [], matchedText: "finger size 11" },
    candidateState: "conflict",
    reviewStatus: "pending",
    lastReviewAction: null,
    founderEditedPayload: null,
    founderEditedTarget: null,
    reviewedAt: null,
    createdAt: "2026-08-01T12:00:00.000Z",
    canonical: false,
    automaticApply: false,
    parserVersion: "gmail-candidates-deterministic-v1",
    supersedesCandidateId: null,
    supersededByCandidateId: null,
  };
}

export function createTravisSolWorld(options?: { throwOnPeople?: boolean }): ConciergeSolWorld {
  const people: ClientSearchResult[] = [
    {
      personId: TRAVIS_PERSON_ID,
      displayName: "Travis Morse",
      organizationName: null,
      email: null,
      phone: null,
      roles: [],
      linkedProjectCount: 1,
      relationshipContext: null,
    },
  ];
  const birthday: BirthdayRead = {
    factId: "fact-sarah",
    personId: TRAVIS_PERSON_ID,
    displayName: "Sarah Miller",
    month: 11,
    day: 12,
    year: null,
    verification: "manual",
    sourceSystem: "concierge-manual",
  };
  const summary: ProjectDeskSummary = {
    projectId: TRAVIS_PROJECT_ID,
    title: "Chicken ring / Travis",
    projectKind: "custom_new_jewelry",
    people: [{ personId: TRAVIS_PERSON_ID, displayName: "Travis Morse" }],
    specs: [{ fieldName: "finger_size", label: "Finger size", value: "12.5" }],
    latestNoteAt: null,
    latestNotePreview: null,
    coverage: {
      people: "available",
      specs: "available",
      notes: "none",
      jobs: "available",
      files: "none",
      email: "not-connected",
    },
    recordCreatedAt: "2026-01-01T00:00:00.000Z",
    projectWork: { connected: false },
    lifecycleStage: "cad",
    lifecycleLabel: "CAD",
    gmailThreadId: TRAVIS_THREAD_ID,
  };
  const desk = {
    ok: true as const,
    desk: {
      projectId: TRAVIS_PROJECT_ID,
      title: "Chicken ring / Travis",
      projectKind: "custom_new_jewelry",
      recordCreatedAt: "2026-01-01T00:00:00.000Z",
      people: [{ personId: TRAVIS_PERSON_ID, displayName: "Travis Morse" }],
      specs: [{ fieldName: "finger_size", label: "Finger size", value: "12.5" }],
      specCorrections: [],
      notes: [],
      latestNoteAt: null,
      latestNotePreview: null,
      coverage: summary.coverage,
      operationalStatus: { kind: "unknown", evidence: "unknown" },
      operatingLayer: { kind: "none" },
      lifecycle: { kind: "custom_new_jewelry", stage: "cad", label: "CAD", stages: [], history: [] },
      openJobs: { connected: true, unresolved: [], unresolvedCount: 0 },
      projectWork: summary.projectWork,
      artifacts: { connected: false },
    } as unknown as ProjectDeskRead,
  } satisfies ProjectDeskGetResult;
  const groups: CurrentProjectOperatingGroup[] = [
    {
      id: "your_turn",
      label: "YOUR TURN",
      count: 1,
      defaultOpen: true,
      toggleId: "g1",
      panelId: "p1",
      heading: "YOUR TURN · 1",
      projects: [card("Chicken ring / Travis")],
    },
    {
      id: "waiting_for_client",
      label: "WAITING FOR CLIENT",
      count: 1,
      defaultOpen: true,
      toggleId: "g2",
      panelId: "p2",
      heading: "WAITING FOR CLIENT · 1",
      projects: [
        card("Lee / Spiegel", {
          projectId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          title: "Lee / Spiegel",
          href: "/executive-dashboard/concierge/projects/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          founderOwnedUnresolved: false,
          lifecycleStage: "client_approval",
          currentAction: { label: "WAITING FOR CLIENT", detail: "Approval", source: "ownership" },
        }),
      ],
    },
  ];
  const mail: GmailIndexedMessage = {
    messageId: "msg-latest",
    threadId: TRAVIS_THREAD_ID,
    sentAt: "2026-09-01T15:00:00.000Z",
    indexedAt: "2026-09-01T15:01:00.000Z",
    subject: "Chicken ring CAD",
    fromEmailHash: null,
    toEmailHashes: [],
    ccEmailHashes: [],
    bccEmailHashes: [],
    direction: "inbound",
    labelIds: [],
    hasAttachments: false,
    sourceSystem: "gmail",
  };
  return {
    async searchPeople(query) {
      if (options?.throwOnPeople) throw new Error("people-failed");
      if (!query.toLowerCase().includes("travis")) return [];
      return people;
    },
    async getPersonProfile(personId) {
      if (personId !== TRAVIS_PERSON_ID) return { ok: false, reason: "not-found" };
      const result: ConciergePersonProfileResult = {
        ok: true,
        profile: {
          person: {
            id: TRAVIS_PERSON_ID,
            displayName: "Travis Morse",
            givenName: "Travis",
            familyName: "Morse",
            organizationName: null,
            email: null,
            phone: null,
            streetAddress: null,
            city: null,
            state: null,
            country: null,
            postalCode: null,
            roles: [],
          },
          relationships: [],
          facts: { current: [], candidateCount: 0, conflictingCount: 0 },
          wishes: [],
          projects: [
            {
              profile: {
                projectId: TRAVIS_PROJECT_ID,
                displayTitle: "Chicken ring / Travis",
                visibility: "internal-only",
                projectKind: "custom_new_jewelry",
              },
              internalHistory: {
                cadJobNumber: "CR5001024",
                orderNumber: null,
                gmailThreadId: TRAVIS_THREAD_ID,
                matchJudgment: null,
                fingerSize: "12.5",
                metal: "14K yellow",
                centerStone: null,
                diamondSupplyNotes: null,
              },
            },
          ],
          sourceNotes: [],
          reviews: { openCount: 0, reasonHistogram: {} },
        },
      };
      return result;
    },
    async listBirthdaysByMonth(month) {
      return month === 11 ? [birthday] : [];
    },
    async listProjects() {
      return [summary];
    },
    async getProjectDesk(projectId) {
      if (projectId !== TRAVIS_PROJECT_ID) return { ok: false, reason: "not-found" };
      return desk;
    },
    async listCurrentProjectCards() {
      return groups.flatMap((row) => row.projects);
    },
    async groupCurrentProjects() {
      return groups;
    },
    async listCandidates() {
      return [travisCandidate()];
    },
    async searchGmailSubjects() {
      return [mail];
    },
    async listGmailByThread(threadId) {
      return threadId === TRAVIS_THREAD_ID ? [mail] : [];
    },
    async fetchProjectEmail() {
      return {
        subject: "Chicken ring CAD",
        sentAt: mail.sentAt,
        direction: "inbound",
        snippet: "Please proceed with the chicken ring CAD as discussed.",
        href: `https://mail.google.com/mail/u/0/#all/${TRAVIS_THREAD_ID}/msg-latest`,
      };
    },
    async loadTodayItems(limit) {
      return [
        {
          title: "Send CAD",
          detail: "Founder action",
          projectTitle: "Chicken ring / Travis",
          personName: "Travis Morse",
        },
        {
          title: "Follow up on approval",
          detail: "Waiting",
          projectTitle: "Lee / Spiegel",
          personName: "Lee",
        },
        {
          title: "Check production",
          detail: "Aging",
          projectTitle: "Pennock band",
          personName: null,
        },
      ].slice(0, limit);
    },
    async searchNotes() {
      return [];
    },
  };
}
