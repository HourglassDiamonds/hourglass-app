import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import { CANDIDATE_MUTATION_BOUNDARY } from "@/lib/continuum/candidates/types";
import { assignCandidateId } from "@/lib/continuum/candidates/identity";
import { packGmailCandidateSourceRef } from "@/lib/continuum/gmail/candidates/source-ref";
import { packHumanIntakeCandidateSourceRef } from "@/lib/continuum/human-intake/candidates/source-ref";
import { packHumanEvidenceSourceRef } from "@/lib/continuum/candidates/human-evidence-source-ref";
import { toCalendarAssociationHandoff } from "../handoff";
import { calendarEventEvidence } from "./fixtures";
import { analyzeCalendarEventAssociation } from "./associate";
import { proposeCalendarAssociationCandidates } from "./propose";
import { ingestCalendarAssociationCandidates } from "./ingest";
import { packCalendarCandidateSourceRef } from "./source-ref";
import type {
  CalendarAssociationPerson,
  CalendarAssociationProject,
  CalendarAssociationWorld,
} from "./types";

const NOW = "2026-03-10T16:00:00.000Z";
const ADA_HASH = hashEmail("ada@client.test")!;
const ALEX_HASH = hashEmail("alex@client.test")!;

function person(
  partial: Partial<CalendarAssociationPerson> &
    Pick<CalendarAssociationPerson, "personId" | "displayName">,
): CalendarAssociationPerson {
  return {
    projectIds: [],
    emailHash: partial.emailHash ?? null,
    ...partial,
  };
}

function project(
  partial: Partial<CalendarAssociationProject> &
    Pick<CalendarAssociationProject, "projectId" | "title">,
): CalendarAssociationProject {
  return {
    cadJobNumber: null,
    orderNumber: null,
    personIds: [],
    founderApprovedCurrent: true,
    ...partial,
  };
}

function world(
  partial: Partial<CalendarAssociationWorld> = {},
): CalendarAssociationWorld {
  return {
    people: [],
    projects: [],
    confirmedLinks: [],
    confirmedParticipantMappings: [],
    internalEmailHashes: [],
    ...partial,
  };
}

describe("Calendar association #23", () => {
  it("keeps #22 evidence unassociated and does not mutate person_id or project_id", () => {
    const evidence = calendarEventEvidence({
      calendar_id: "primary",
      calendar_event_id: "evt-1",
      title: "Chelsea CAD CR5001024",
      attendees: [
        {
          display_name: "Ada",
          email_hash: ADA_HASH,
          email_present: true,
          response_status: "accepted",
          optional: false,
          organizer: false,
          self: false,
        },
      ],
    });
    const chelsea = project({
      projectId: "proj-chelsea",
      title: "Chelsea",
      cadJobNumber: "CR5001024",
    });
    const analysis = analyzeCalendarEventAssociation(
      evidence,
      world({ projects: [chelsea] }),
    );
    assert.equal(evidence.person_id, null);
    assert.equal(evidence.project_id, null);
    const handoff = toCalendarAssociationHandoff(evidence);
    assert.equal(handoff.association_status, "unassociated");
    assert.deepEqual(handoff.association_candidates, []);
    assert.equal(handoff.person_id, null);
    assert.equal(handoff.project_id, null);
    assert.equal(analysis.projectHits[0]?.projectId, "proj-chelsea");
  });

  it("associates an exact CAD identifier in the title to one Project", () => {
    const proposed = proposeCalendarAssociationCandidates({
      createdAt: NOW,
      world: world({
        projects: [
          project({
            projectId: "proj-chelsea",
            title: "Chelsea",
            cadJobNumber: "CR5001024",
          }),
          project({
            projectId: "proj-other",
            title: "Other",
            cadJobNumber: "C017755",
          }),
        ],
      }),
      evidence: [
        calendarEventEvidence({
          calendar_id: "primary",
          calendar_event_id: "cad-1",
          title: "Chelsea CAD CR5001024",
        }),
      ],
    });
    const hits = proposed.candidates.filter(
      (row) => row.candidateType === "project_association",
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.payload.kind, "project_association");
    if (hits[0]?.payload.kind === "project_association") {
      assert.equal(hits[0].payload.match, "exact");
      assert.equal(hits[0].payload.token, "CR5001024");
    }
    if (hits[0]?.proposedTarget.kind === "project") {
      assert.equal(hits[0].proposedTarget.projectId, "proj-chelsea");
    }
    assert.equal(hits[0]?.confidence, "high");
    assert.equal(hits[0]?.canonical, false);
    assert.equal(hits[0]?.automaticApply, false);
    assert.equal(hits[0]?.reviewStatus, "pending");
  });

  it("emits separate ambiguous Project candidates when a CAD token hits two Projects", () => {
    const proposed = proposeCalendarAssociationCandidates({
      createdAt: NOW,
      world: world({
        projects: [
          project({
            projectId: "proj-a",
            title: "A",
            cadJobNumber: "CR5001024",
          }),
          project({
            projectId: "proj-b",
            title: "B",
            cadJobNumber: "CR5001024",
          }),
        ],
      }),
      evidence: [
        calendarEventEvidence({
          calendar_id: "primary",
          calendar_event_id: "cad-amb",
          title: "CAD CR5001024",
        }),
      ],
    });
    const hits = proposed.candidates.filter(
      (row) => row.candidateType === "project_association",
    );
    assert.equal(hits.length, 2);
    assert.ok(hits.every((row) => row.confidence === "ambiguous"));
    assert.ok(
      hits.every(
        (row) =>
          row.payload.kind === "project_association" && row.payload.match === "ambiguous",
      ),
    );
    const ids = hits
      .map((row) =>
        row.proposedTarget.kind === "project" ? row.proposedTarget.projectId : null,
      )
      .sort();
    assert.deepEqual(ids, ["proj-a", "proj-b"]);
  });

  it("does not treat email as identity and does not closest-name match", () => {
    const ada = person({
      personId: "person-ada",
      displayName: "Ada Lovelace",
      emailHash: ADA_HASH,
      projectIds: ["proj-ada"],
    });
    const alex = person({
      personId: "person-alex",
      displayName: "Alex Chen",
      emailHash: ALEX_HASH,
    });
    const proposed = proposeCalendarAssociationCandidates({
      createdAt: NOW,
      world: world({
        people: [ada, alex],
        projects: [
          project({
            projectId: "proj-ada",
            title: "Ada ring",
            personIds: ["person-ada"],
          }),
        ],
      }),
      evidence: [
        calendarEventEvidence({
          calendar_id: "primary",
          calendar_event_id: "email-only",
          title: "Catch up",
          attendees: [
            {
              display_name: "Ada",
              email_hash: ADA_HASH,
              email_present: true,
              response_status: "accepted",
              optional: false,
              organizer: false,
              self: false,
            },
            {
              display_name: "Alexandra Chen",
              email_hash: hashEmail("alexandra@other.test"),
              email_present: true,
              response_status: "accepted",
              optional: false,
              organizer: false,
              self: false,
            },
          ],
        }),
      ],
    });
    const people = proposed.candidates.filter(
      (row) => row.candidateType === "person_association",
    );
    assert.equal(people.length, 1);
    assert.equal(people[0]?.payload.kind, "person_association");
    if (people[0]?.payload.kind === "person_association") {
      assert.equal(people[0].payload.mintPerson, false);
      assert.equal(people[0].payload.mergePersons, false);
      assert.equal(people[0].payload.emailHash, ADA_HASH);
    }
    if (people[0]?.proposedTarget.kind === "person") {
      assert.equal(people[0].proposedTarget.personId, null);
    }
    assert.equal(people[0]?.confidence, "low");
    assert.ok(
      people[0]?.evidenceBasis.ruleIds.includes("email_hash_supporting_not_identity"),
    );
    assert.equal(
      proposed.candidates.filter((row) => row.candidateType === "project_association")
        .length,
      0,
    );
    assert.equal(
      proposed.candidates.some((row) =>
        row.evidenceBasis.ruleIds.includes("closest_name"),
      ),
      false,
    );
  });

  it("proposes an exact Person from a founder-confirmed Calendar participant mapping", () => {
    const ada = person({
      personId: "person-ada",
      displayName: "Ada Lovelace",
      emailHash: ADA_HASH,
      projectIds: ["proj-ada"],
    });
    const proposed = proposeCalendarAssociationCandidates({
      createdAt: NOW,
      world: world({
        people: [ada],
        projects: [
          project({
            projectId: "proj-ada",
            title: "Ada ring",
            personIds: ["person-ada"],
          }),
        ],
        confirmedParticipantMappings: [
          { emailHash: ADA_HASH, personId: "person-ada" },
        ],
      }),
      evidence: [
        calendarEventEvidence({
          calendar_id: "primary",
          calendar_event_id: "mapped",
          title: "Studio visit",
          attendees: [
            {
              display_name: "Ada",
              email_hash: ADA_HASH,
              email_present: true,
              response_status: "accepted",
              optional: false,
              organizer: false,
              self: false,
            },
          ],
        }),
      ],
    });
    const people = proposed.candidates.filter(
      (row) => row.candidateType === "person_association",
    );
    assert.equal(people.length, 1);
    if (people[0]?.proposedTarget.kind === "person") {
      assert.equal(people[0].proposedTarget.personId, "person-ada");
    }
    assert.equal(people[0]?.confidence, "high");
    assert.ok(
      people[0]?.evidenceBasis.ruleIds.includes(
        "founder_confirmed_calendar_participant",
      ),
    );
    const projects = proposed.candidates.filter(
      (row) => row.candidateType === "project_association",
    );
    assert.equal(projects.length, 1);
    if (projects[0]?.proposedTarget.kind === "project") {
      assert.equal(projects[0].proposedTarget.projectId, "proj-ada");
    }
    assert.ok(
      projects[0]?.evidenceBasis.ruleIds.includes("unique_person_active_project"),
    );
  });

  it("emits separate ambiguous Person proposals when participant mappings collide", () => {
    const proposed = proposeCalendarAssociationCandidates({
      createdAt: NOW,
      world: world({
        people: [
          person({
            personId: "person-ada",
            displayName: "Ada",
            emailHash: ADA_HASH,
          }),
          person({
            personId: "person-bea",
            displayName: "Bea",
            emailHash: ADA_HASH,
          }),
        ],
        confirmedParticipantMappings: [
          { emailHash: ADA_HASH, personId: "person-ada" },
          { emailHash: ADA_HASH, personId: "person-bea" },
        ],
      }),
      evidence: [
        calendarEventEvidence({
          calendar_id: "primary",
          calendar_event_id: "collide",
          attendees: [
            {
              display_name: "Guest",
              email_hash: ADA_HASH,
              email_present: true,
              response_status: "accepted",
              optional: false,
              organizer: false,
              self: false,
            },
          ],
        }),
      ],
    });
    const people = proposed.candidates.filter(
      (row) => row.candidateType === "person_association",
    );
    assert.equal(people.length, 2);
    assert.ok(people.every((row) => row.confidence === "ambiguous"));
    const ids = people
      .map((row) =>
        row.proposedTarget.kind === "person" ? row.proposedTarget.personId : null,
      )
      .sort();
    assert.deepEqual(ids, ["person-ada", "person-bea"]);
  });

  it("emits separate ambiguous Projects when a strong Person has two current Projects", () => {
    const proposed = proposeCalendarAssociationCandidates({
      createdAt: NOW,
      world: world({
        people: [
          person({
            personId: "person-ada",
            displayName: "Ada",
            emailHash: ADA_HASH,
            projectIds: ["proj-a", "proj-b"],
          }),
        ],
        projects: [
          project({
            projectId: "proj-a",
            title: "A",
            personIds: ["person-ada"],
          }),
          project({
            projectId: "proj-b",
            title: "B",
            personIds: ["person-ada"],
          }),
        ],
        confirmedParticipantMappings: [
          { emailHash: ADA_HASH, personId: "person-ada" },
        ],
      }),
      evidence: [
        calendarEventEvidence({
          calendar_id: "primary",
          calendar_event_id: "two-proj",
          attendees: [
            {
              display_name: "Ada",
              email_hash: ADA_HASH,
              email_present: true,
              response_status: "accepted",
              optional: false,
              organizer: false,
              self: false,
            },
          ],
        }),
      ],
    });
    const projects = proposed.candidates.filter(
      (row) => row.candidateType === "project_association",
    );
    assert.equal(projects.length, 2);
    assert.ok(projects.every((row) => row.confidence === "ambiguous"));
  });

  it("does not mint, merge, create Open Jobs, or change Kind or lifecycle", () => {
    const proposed = proposeCalendarAssociationCandidates({
      createdAt: NOW,
      world: world({
        people: [
          person({
            personId: "person-ada",
            displayName: "Ada",
            emailHash: ADA_HASH,
          }),
        ],
        projects: [
          project({
            projectId: "proj-chelsea",
            title: "Chelsea",
            cadJobNumber: "CR5001024",
          }),
        ],
      }),
      evidence: [
        calendarEventEvidence({
          calendar_id: "primary",
          calendar_event_id: "safety",
          title: "Please create an Open Job for Chelsea CAD CR5001024",
          attendees: [
            {
              display_name: "Ada",
              email_hash: ADA_HASH,
              email_present: true,
              response_status: "accepted",
              optional: false,
              organizer: false,
              self: false,
            },
          ],
        }),
      ],
    });
    assert.equal(proposed.liveModelCalls, false);
    assert.equal(proposed.mutationBoundary, CANDIDATE_MUTATION_BOUNDARY);
    assert.ok(
      proposed.candidates.every(
        (row) =>
          row.canonical === false &&
          row.automaticApply === false &&
          row.reviewStatus === "pending",
      ),
    );
    assert.equal(
      proposed.candidates.filter((row) => row.candidateType === "open_job").length,
      0,
    );
    assert.ok(
      proposed.candidates.every((row) => {
        if (row.payload.kind !== "person_association") return true;
        return row.payload.mintPerson === false && row.payload.mergePersons === false;
      }),
    );
  });

  it("reprocess of the same event does not duplicate Candidates", async () => {
    const store = new InMemoryCandidateStore();
    const input = {
      createdAt: NOW,
      world: world({
        projects: [
          project({
            projectId: "proj-chelsea",
            title: "Chelsea",
            cadJobNumber: "CR5001024",
          }),
        ],
      }),
      evidence: [
        calendarEventEvidence({
          calendar_id: "primary",
          calendar_event_id: "dup",
          title: "CAD CR5001024",
        }),
      ],
    };
    const first = await ingestCalendarAssociationCandidates(store, input);
    const second = await ingestCalendarAssociationCandidates(store, input);
    assert.ok(first.insertedIds.length > 0);
    assert.equal(second.insertedIds.length, 0);
    assert.equal(second.duplicateIds.length, first.insertedIds.length);
    assert.equal((await store.list()).length, first.insertedIds.length);
  });

  it("does not collide Calendar source_refs with Gmail, Human Intake, or human evidence", () => {
    const packed = packCalendarCandidateSourceRef({
      calendarId: "primary",
      calendarEventId: "evt-1",
    });
    assert.equal(packed.ok, true);
    if (!packed.ok) return;
    assert.equal(packed.sourceRef, "cal1|primary|evt-1");
    const gmail = packGmailCandidateSourceRef({
      threadId: "primary",
      messageId: "evt-1",
    });
    const intake = packHumanIntakeCandidateSourceRef({
      sourceId: "primary",
      start: 0,
      end: 1,
    });
    const human = packHumanEvidenceSourceRef({ sourceId: "primary" });
    assert.ok(gmail.ok && intake.ok && human.ok);
    if (!gmail.ok || !intake.ok || !human.ok) return;
    const calendarDraft = assignCandidateId({
      candidateId: "",
      sourceSystem: "google_calendar",
      sourceRef: packed.sourceRef,
      sourceTimestamp: NOW,
      candidateType: "project_association",
      proposedTarget: { kind: "project", projectId: "p1" },
      payload: {
        kind: "project_association",
        title: "Chelsea",
        token: "CR5001024",
        match: "exact",
      },
      confidence: "high",
      evidenceBasis: { ruleIds: ["exact_cad_job"], matchedText: "CR5001024" },
      candidateState: "active",
      canonical: false,
      automaticApply: false,
      parserVersion: "google-calendar-association-deterministic-v1",
    });
    const gmailDraft = assignCandidateId({
      candidateId: "",
      sourceSystem: "gmail",
      sourceRef: gmail.sourceRef,
      sourceTimestamp: NOW,
      candidateType: "project_association",
      proposedTarget: { kind: "project", projectId: "p1" },
      payload: {
        kind: "project_association",
        title: "Chelsea",
        token: "CR5001024",
        match: "exact",
      },
      confidence: "high",
      evidenceBasis: { ruleIds: ["exact_cad_job"], matchedText: "CR5001024" },
      candidateState: "active",
      canonical: false,
      automaticApply: false,
      parserVersion: "gmail-candidates-deterministic-v1",
    });
    assert.notEqual(calendarDraft.candidateId, gmailDraft.candidateId);
    assert.notEqual(packed.sourceRef, gmail.sourceRef);
    assert.notEqual(packed.sourceRef, intake.sourceRef);
    assert.notEqual(packed.sourceRef, human.sourceRef);
    assert.ok(packed.sourceRef.startsWith("cal1|"));
    assert.ok(gmail.sourceRef.startsWith("gc1|"));
    assert.ok(intake.sourceRef.startsWith("hi1|"));
    assert.ok(human.sourceRef.startsWith("he1|"));
  });

  it("keeps same event + same proposal as one id and splits different Projects", () => {
    const evidence = calendarEventEvidence({
      calendar_id: "primary",
      calendar_event_id: "split",
      title: "CAD CR5001024",
    });
    const proposed = proposeCalendarAssociationCandidates({
      createdAt: NOW,
      world: world({
        projects: [
          project({
            projectId: "proj-a",
            title: "A",
            cadJobNumber: "CR5001024",
          }),
          project({
            projectId: "proj-b",
            title: "B",
            cadJobNumber: "CR5001024",
          }),
        ],
      }),
      evidence: [evidence, evidence],
    });
    const hits = proposed.candidates.filter(
      (row) => row.candidateType === "project_association",
    );
    assert.equal(hits.length, 2);
    assert.notEqual(hits[0]?.candidateId, hits[1]?.candidateId);
    const again = proposeCalendarAssociationCandidates({
      createdAt: NOW,
      world: world({
        projects: [
          project({
            projectId: "proj-a",
            title: "A",
            cadJobNumber: "CR5001024",
          }),
          project({
            projectId: "proj-b",
            title: "B",
            cadJobNumber: "CR5001024",
          }),
        ],
      }),
      evidence: [evidence],
    });
    assert.deepEqual(
      again.candidates.map((row) => row.candidateId).sort(),
      hits.map((row) => row.candidateId).sort(),
    );
  });

  it("skips cancelled events and self attendees", () => {
    const cancelled = analyzeCalendarEventAssociation(
      calendarEventEvidence({
        calendar_id: "primary",
        calendar_event_id: "cx",
        status: "cancelled",
        title: "CAD CR5001024",
      }),
      world({
        projects: [
          project({
            projectId: "proj-chelsea",
            title: "Chelsea",
            cadJobNumber: "CR5001024",
          }),
        ],
      }),
    );
    assert.equal(cancelled.skipped, true);
    assert.equal(cancelled.projectHits.length, 0);
    const proposed = proposeCalendarAssociationCandidates({
      createdAt: NOW,
      world: world({
        people: [
          person({
            personId: "person-ada",
            displayName: "Ada",
            emailHash: ADA_HASH,
          }),
        ],
        confirmedParticipantMappings: [
          { emailHash: ADA_HASH, personId: "person-ada" },
        ],
      }),
      evidence: [
        calendarEventEvidence({
          calendar_id: "primary",
          calendar_event_id: "self",
          attendees: [
            {
              display_name: "Founder",
              email_hash: ADA_HASH,
              email_present: true,
              response_status: "accepted",
              optional: false,
              organizer: false,
              self: true,
            },
          ],
        }),
      ],
    });
    assert.equal(proposed.candidates.length, 0);
  });

  it("does not read Calendar descriptions to improve matching", () => {
    const proposed = proposeCalendarAssociationCandidates({
      createdAt: NOW,
      world: world({
        projects: [
          project({
            projectId: "proj-chelsea",
            title: "Chelsea",
            cadJobNumber: "CR5001024",
          }),
        ],
      }),
      evidence: [
        calendarEventEvidence({
          calendar_id: "primary",
          calendar_event_id: "desc",
          title: "Studio visit",
          description_present: true,
        }),
      ],
    });
    assert.equal(
      proposed.candidates.filter((row) => row.candidateType === "project_association")
        .length,
      0,
    );
  });
});
