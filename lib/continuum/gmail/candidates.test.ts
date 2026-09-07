import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { GMAIL_SOURCE_SYSTEM } from "@/lib/continuum/client-memory/gmail/types";
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import { CANDIDATE_MUTATION_BOUNDARY } from "@/lib/continuum/candidates/types";
import { ingestGmailCandidates } from "./candidates/ingest";
import { proposeGmailCandidates } from "./candidates/propose";
import { packGmailCandidateSourceRef } from "./candidates/source-ref";
import type {
  GmailCandidateEvidence,
  GmailCandidatePerson,
  GmailCandidateProject,
  GmailCandidateWorld,
} from "./candidates/types";

const NOW = "2026-09-06T12:00:00.000Z";

function indexed(input: {
  messageId: string;
  threadId: string;
  sentAt: string;
  subject?: string;
  fromEmail?: string;
  direction?: GmailIndexedMessage["direction"];
  hasAttachments?: boolean;
}): GmailIndexedMessage {
  return {
    messageId: input.messageId,
    threadId: input.threadId,
    sentAt: input.sentAt,
    indexedAt: NOW,
    subject: input.subject ?? null,
    fromEmailHash: hashEmail(input.fromEmail ?? null),
    toEmailHashes: [],
    ccEmailHashes: [],
    bccEmailHashes: [],
    direction: input.direction ?? "inbound",
    labelIds: (input.direction ?? "inbound") === "outbound" ? ["SENT"] : ["INBOX"],
    hasAttachments: Boolean(input.hasAttachments),
    sourceSystem: GMAIL_SOURCE_SYSTEM,
  };
}

function evidence(
  input: Parameters<typeof indexed>[0] & {
    plaintext?: string;
    filenames?: readonly string[];
  },
): GmailCandidateEvidence {
  const row = indexed(input);
  return {
    indexed: row,
    plaintext: input.plaintext ?? null,
    fromEmailHash: row.fromEmailHash,
    attachments: (input.filenames ?? []).map((filename, index) => ({
      attachmentId: `att-${row.messageId}-${index}`,
      filename,
    })),
  };
}

function person(
  partial: Partial<GmailCandidatePerson> & Pick<GmailCandidatePerson, "personId" | "displayName">,
): GmailCandidatePerson {
  return {
    role: "client",
    projectIds: [],
    ...partial,
    emailHash:
      partial.emailHash ??
      hashEmail(`${partial.displayName.replace(/\s+/g, "").toLowerCase()}@client.test`),
  };
}

function project(
  partial: Partial<GmailCandidateProject> & Pick<GmailCandidateProject, "projectId" | "title">,
): GmailCandidateProject {
  return {
    gmailThreadId: null,
    cadJobNumber: null,
    orderNumber: null,
    fingerSize: null,
    metal: null,
    centerStone: null,
    diamondSupplyNotes: null,
    personIds: [],
    founderApprovedCurrent: true,
    ...partial,
  };
}

function world(
  people: readonly GmailCandidatePerson[],
  projects: readonly GmailCandidateProject[],
  internal: readonly string[] = [],
): GmailCandidateWorld {
  return { people, projects, internalEmailHashes: internal };
}

describe("Gmail → Candidate adapter", () => {
  it("associates an exact CAD identifier to one Project", () => {
    const chelsea = project({
      projectId: "proj-chelsea",
      title: "Chelsea",
      cadJobNumber: "CR5001024",
    });
    const other = project({
      projectId: "proj-other",
      title: "Other",
      cadJobNumber: "C017755",
    });
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world([], [chelsea, other]),
      evidence: [
        evidence({
          messageId: "m-cad",
          threadId: "t-unknown",
          sentAt: "2026-07-12T11:00:00.000Z",
          subject: "Chelsea CAD CR5001024",
          plaintext: "Wedding band CAD CR5001024",
        }),
      ],
    });
    const hits = proposed.candidates.filter(
      (row) => row.candidateType === "project_association",
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.proposedTarget.kind, "project");
    if (hits[0]?.proposedTarget.kind === "project") {
      assert.equal(hits[0].proposedTarget.projectId, "proj-chelsea");
    }
    assert.equal(hits[0]?.payload.kind, "project_association");
    if (hits[0]?.payload.kind === "project_association") {
      assert.equal(hits[0].payload.match, "exact");
      assert.equal(hits[0].payload.token, "CR5001024");
    }
    assert.equal(hits[0]?.confidence, "high");
  });

  it("emits separate ambiguous Project candidates when a person has two current Projects", () => {
    const ada = person({
      personId: "person-ada",
      displayName: "Ada",
      emailHash: hashEmail("ada@client.test"),
      projectIds: ["proj-a", "proj-b"],
    });
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world(
        [ada],
        [
          project({
            projectId: "proj-a",
            title: "Ada ring",
            personIds: ["person-ada"],
          }),
          project({
            projectId: "proj-b",
            title: "Ada band",
            personIds: ["person-ada"],
          }),
        ],
      ),
      evidence: [
        evidence({
          messageId: "m-amb",
          threadId: "t-unknown-amb",
          sentAt: "2026-04-01T12:00:00.000Z",
          fromEmail: "ada@client.test",
          plaintext: "Checking in on the ring.",
        }),
      ],
    });
    const hits = proposed.candidates.filter(
      (row) => row.candidateType === "project_association",
    );
    assert.equal(hits.length, 2);
    assert.deepEqual(
      hits.map((row) =>
        row.proposedTarget.kind === "project" ? row.proposedTarget.projectId : null,
      ).sort(),
      ["proj-a", "proj-b"],
    );
    assert.ok(hits.every((row) => row.confidence === "ambiguous"));
    assert.ok(
      hits.every(
        (row) =>
          row.payload.kind === "project_association" && row.payload.match === "ambiguous",
      ),
    );
  });

  it("proposes a Person candidate without minting or merging", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world([], []),
      evidence: [
        evidence({
          messageId: "m-person",
          threadId: "t-person",
          sentAt: "2026-04-01T12:00:00.000Z",
          fromEmail: "new.person@client.test",
          plaintext: "Hello from a new sender.",
        }),
      ],
    });
    const hits = proposed.candidates.filter(
      (row) => row.candidateType === "person_association",
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.proposedTarget.kind, "person");
    if (hits[0]?.proposedTarget.kind === "person") {
      assert.equal(hits[0].proposedTarget.personId, null);
    }
    assert.equal(hits[0]?.payload.kind, "person_association");
    if (hits[0]?.payload.kind === "person_association") {
      assert.equal(hits[0].payload.mintPerson, false);
      assert.equal(hits[0].payload.mergePersons, false);
      assert.equal(hits[0].payload.displayName, null);
      assert.equal(hits[0].payload.emailHash, hashEmail("new.person@client.test"));
    }
    assert.equal(hits[0]?.confidence, "low");
  });

  it("proposes a blank structured spec field without writing it", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world(
        [],
        [
          project({
            projectId: "proj-sarah",
            title: "Sarah",
            gmailThreadId: "aaaaaaaaaa",
            fingerSize: null,
          }),
        ],
      ),
      evidence: [
        evidence({
          messageId: "m-size",
          threadId: "aaaaaaaaaa",
          sentAt: "2026-06-20T14:22:00.000Z",
          plaintext: "Finger size is 8.5",
        }),
      ],
    });
    const specs = proposed.candidates.filter(
      (row) =>
        row.candidateType === "structured_spec" &&
        row.payload.kind === "structured_spec" &&
        row.payload.fieldName === "finger_size",
    );
    assert.equal(specs.length, 1);
    assert.equal(specs[0]?.status, "pending");
    if (specs[0]?.payload.kind === "structured_spec") {
      assert.equal(specs[0].payload.proposedValue, "8.5");
      assert.equal(specs[0].payload.currentValue, null);
      assert.equal(specs[0].payload.conflict, false);
    }
  });

  it("marks conflicting structured spec evidence as review required", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world(
        [],
        [
          project({
            projectId: "proj-travis",
            title: "Travis",
            gmailThreadId: "cccccccccc",
            fingerSize: "12",
          }),
        ],
      ),
      evidence: [
        evidence({
          messageId: "m-conflict",
          threadId: "cccccccccc",
          sentAt: "2025-11-02T12:00:00.000Z",
          plaintext: "Historical correction: ring size is 12.5.",
        }),
      ],
    });
    const specs = proposed.candidates.filter(
      (row) =>
        row.payload.kind === "structured_spec" &&
        row.payload.fieldName === "finger_size",
    );
    assert.equal(specs.length, 1);
    assert.equal(specs[0]?.status, "conflict_review_required");
    if (specs[0]?.payload.kind === "structured_spec") {
      assert.equal(specs[0].payload.proposedValue, "12.5");
      assert.equal(specs[0].payload.currentValue, "12");
      assert.equal(specs[0].payload.conflict, true);
    }
    assert.ok(
      specs[0]?.evidenceBasis.ruleIds.includes("spec_conflict_review_required"),
    );
  });

  it("turns an explicit founder commitment into an Open Job candidate only", () => {
    const founderHash = hashEmail("founder@hourglass.test");
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world([], [], founderHash ? [founderHash] : []),
      evidence: [
        evidence({
          messageId: "m-commit",
          threadId: "t-commit",
          sentAt: "2026-03-14T18:22:00.000Z",
          fromEmail: "founder@hourglass.test",
          direction: "outbound",
          plaintext: "I'll send this tomorrow.",
        }),
      ],
    });
    const jobs = proposed.candidates.filter((row) => row.candidateType === "open_job");
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.payload.kind, "open_job");
    if (jobs[0]?.payload.kind === "open_job") {
      assert.equal(jobs[0].payload.jobKind, "commitment");
      assert.equal(jobs[0].payload.waitingOnActor, "founder");
      assert.equal(jobs[0].payload.createJob, false);
    }
    assert.equal(
      proposed.candidates.some((row) => row.candidateType === "person_association"),
      false,
    );
  });

  it("captures vendor waiting language as an external dependency candidate", () => {
    const vendor = person({
      personId: "person-vendor",
      displayName: "CAD vendor",
      emailHash: hashEmail("cad@vendor.test"),
      role: "vendor-contact",
      projectIds: ["proj-travis"],
    });
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world(
        [vendor],
        [
          project({
            projectId: "proj-travis",
            title: "Travis",
            gmailThreadId: "cccccccccc",
            personIds: ["person-vendor"],
          }),
        ],
      ),
      evidence: [
        evidence({
          messageId: "m-vendor",
          threadId: "cccccccccc",
          sentAt: "2026-03-08T16:40:00.000Z",
          fromEmail: "cad@vendor.test",
          plaintext: "We'll send the revised CAD when ready.",
        }),
      ],
    });
    const jobs = proposed.candidates.filter((row) => row.candidateType === "open_job");
    assert.equal(jobs.length, 1);
    if (jobs[0]?.payload.kind === "open_job") {
      assert.equal(jobs[0].payload.jobKind, "blocked_issue");
      assert.equal(jobs[0].payload.waitingOnActor, "vendor");
      assert.equal(jobs[0].payload.createJob, false);
    }
  });

  it("does not invent an Open Job from a CAD attachment alone", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world(
        [],
        [project({ projectId: "proj-cad", title: "CAD only", gmailThreadId: "t-cad" })],
      ),
      evidence: [
        evidence({
          messageId: "m-att",
          threadId: "t-cad",
          sentAt: "2026-04-01T12:00:00.000Z",
          hasAttachments: true,
          filenames: ["band-cad.stl"],
          plaintext: "CAD attached.",
        }),
      ],
    });
    assert.equal(
      proposed.candidates.some((row) => row.candidateType === "open_job"),
      false,
    );
  });

  it("extracts an explicit named date using the source timestamp year", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world([], []),
      evidence: [
        evidence({
          messageId: "m-date",
          threadId: "t-date",
          sentAt: "2026-01-10T12:00:00.000Z",
          plaintext: "The wedding is September 13.",
        }),
      ],
    });
    const dates = proposed.candidates.filter((row) => row.candidateType === "date");
    assert.ok(dates.length >= 1);
    const wedding = dates.find(
      (row) => row.payload.kind === "date" && row.payload.isoDate === "2026-09-13",
    );
    assert.ok(wedding);
    if (wedding?.payload.kind === "date") {
      assert.equal(wedding.payload.sourceTimestamp, "2026-01-10T12:00:00.000Z");
      assert.equal(wedding.payload.precision, "day");
      assert.equal(wedding.payload.resolutionCalendar, "source-timestamp-utc-date");
    }
  });

  it("resolves relative dates from the source timestamp, not wall clock", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world([], []),
      evidence: [
        evidence({
          messageId: "m-rel",
          threadId: "t-rel",
          sentAt: "2026-03-14T18:22:00.000Z",
          direction: "outbound",
          fromEmail: "founder@hourglass.test",
          plaintext: "I'll send this tomorrow. Please follow up in two weeks. Next Monday works.",
        }),
      ],
    });
    const tomorrow = proposed.candidates.find(
      (row) => row.payload.kind === "date" && /tomorrow/i.test(row.payload.raw),
    );
    assert.equal(tomorrow?.payload.kind, "date");
    if (tomorrow?.payload.kind === "date") {
      assert.equal(tomorrow.payload.isoDate, "2026-03-15");
    }
    const follow = proposed.candidates.find((row) => row.candidateType === "follow_up");
    assert.equal(follow?.payload.kind, "follow_up");
    if (follow?.payload.kind === "follow_up") {
      assert.equal(follow.payload.dueAt, "2026-03-28");
      assert.equal(follow.payload.sourceTimestamp, "2026-03-14T18:22:00.000Z");
    }
    const monday = proposed.candidates.find(
      (row) => row.payload.kind === "date" && /next monday/i.test(row.payload.raw),
    );
    if (monday?.payload.kind === "date") {
      assert.equal(monday.payload.isoDate, "2026-03-16");
    }
  });

  it("does not create duplicate logical candidates when the same Gmail evidence is reprocessed", async () => {
    const store = new InMemoryCandidateStore();
    const input = {
      createdAt: NOW,
      world: world(
        [],
        [project({ projectId: "proj-c", title: "Chelsea", cadJobNumber: "CR5001024" })],
      ),
      evidence: [
        evidence({
          messageId: "m-dup",
          threadId: "t-dup",
          sentAt: "2026-07-12T11:00:00.000Z",
          plaintext: "CAD CR5001024",
        }),
      ],
    };
    const first = await ingestGmailCandidates(store, input);
    const second = await ingestGmailCandidates(store, input);
    assert.ok(first.insertedIds.length > 0);
    assert.equal(second.insertedIds.length, 0);
    assert.ok(second.duplicateIds.length > 0);
    assert.equal((await store.list()).length, first.candidates.length);
  });

  it("keeps stale and newer evidence auditable instead of deleting", async () => {
    const store = new InMemoryCandidateStore();
    const worldRow = world(
      [],
      [
        project({
          projectId: "proj-metal",
          title: "Pennock",
          gmailThreadId: "threadpennock",
          metal: null,
        }),
      ],
    );
    await ingestGmailCandidates(store, {
      createdAt: NOW,
      world: worldRow,
      evidence: [
        evidence({
          messageId: "m-old",
          threadId: "threadpennock",
          sentAt: "2025-01-01T12:00:00.000Z",
          plaintext: "Metal is platinum.",
        }),
      ],
    });
    await ingestGmailCandidates(store, {
      createdAt: NOW,
      world: worldRow,
      evidence: [
        evidence({
          messageId: "m-new",
          threadId: "threadpennock",
          sentAt: "2026-04-02T15:00:00.000Z",
          plaintext: "Metal is platinum.",
        }),
      ],
    });
    const specs = (await store.list()).filter(
      (row) =>
        row.payload.kind === "structured_spec" && row.payload.fieldName === "metal",
    );
    assert.equal(specs.length, 2);
    const older = specs.find((row) => row.sourceTimestamp.startsWith("2025"));
    const newer = specs.find((row) => row.sourceTimestamp.startsWith("2026"));
    assert.equal(older?.status, "superseded");
    assert.equal(older?.supersededByCandidateId, newer?.candidateId);
    assert.ok(newer?.status === "pending" || newer?.status === "conflict_review_required");
    assert.equal(newer?.supersedesCandidateId, older?.candidateId);
    assert.equal(newer?.supersededByCandidateId, null);
  });

  it("never marks candidates canonical and never enables automatic apply", () => {
    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: world([], []),
      evidence: [
        evidence({
          messageId: "m-canon",
          threadId: "t-canon",
          sentAt: "2026-01-01T00:00:00.000Z",
          plaintext: "I'll send this tomorrow.",
          direction: "outbound",
          fromEmail: "founder@hourglass.test",
        }),
      ],
    });
    assert.deepEqual(proposed.mutationBoundary, CANDIDATE_MUTATION_BOUNDARY);
    assert.equal(proposed.liveModelCalls, false);
    assert.ok(proposed.candidates.length > 0);
    for (const row of proposed.candidates) {
      assert.equal(row.canonical, false);
      assert.equal(row.automaticApply, false);
    }
  });

  it("preserves full Gmail source_ref instead of truncating provenance", () => {
    const messageId = "m".repeat(64);
    const threadId = "t".repeat(64);
    const packed = packGmailCandidateSourceRef({ messageId, threadId });
    assert.equal(packed.ok, true);
    if (packed.ok) {
      assert.ok(packed.sourceRef.includes(messageId));
      assert.ok(packed.sourceRef.includes(threadId));
      assert.ok(packed.sourceRef.startsWith("gc1|"));
    }
  });
});
