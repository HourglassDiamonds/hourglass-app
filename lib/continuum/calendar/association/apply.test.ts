import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { InMemoryCandidateStore } from "@/lib/continuum/candidates/store";
import { proposeCalendarAssociationCandidates } from "./propose";
import { ingestCalendarAssociationCandidates } from "./ingest";
import { reviewCalendarAssociationCandidate } from "./apply";
import { InMemoryCalendarAssociationWriter } from "./writer";
import { calendarEventEvidence } from "./fixtures";
import type {
  CalendarAssociationPerson,
  CalendarAssociationProject,
  CalendarAssociationWorld,
} from "./types";

const NOW = "2026-03-10T16:00:00.000Z";
const ADA_HASH = hashEmail("ada@client.test")!;

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

describe("Calendar association founder review", () => {
  it("gates canonical writes until founder approval and writes only a Calendar source link", async () => {
    const store = new InMemoryCandidateStore();
    const writer = new InMemoryCalendarAssociationWriter();
    const ada: CalendarAssociationPerson = {
      personId: "person-ada",
      displayName: "Ada",
      emailHash: ADA_HASH,
      projectIds: ["proj-ada"],
    };
    const proj: CalendarAssociationProject = {
      projectId: "proj-ada",
      title: "Ada ring",
      cadJobNumber: "CR5001024",
      orderNumber: null,
      personIds: ["person-ada"],
      founderApprovedCurrent: true,
    };
    const extracted = await ingestCalendarAssociationCandidates(store, {
      createdAt: NOW,
      world: world({
        people: [ada],
        projects: [proj],
        confirmedParticipantMappings: [
          { emailHash: ADA_HASH, personId: "person-ada" },
        ],
      }),
      evidence: [
        calendarEventEvidence({
          calendar_id: "primary",
          calendar_event_id: "review-1",
          title: "CAD CR5001024",
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
    const personRow = extracted.candidates.find(
      (row) => row.candidateType === "person_association",
    );
    const projectRow = extracted.candidates.find(
      (row) => row.candidateType === "project_association",
    );
    assert.ok(personRow && projectRow);
    assert.equal(personRow.reviewStatus, "pending");
    assert.equal((await writer.listLinks()).length, 0);

    const deps = {
      nowIso: () => NOW,
      candidates: store,
      writer,
      getPersonName: async (id: string) => (id === "person-ada" ? "Ada" : null),
      getProjectTitle: async (id: string) => (id === "proj-ada" ? "Ada ring" : null),
    };

    const blocked = await reviewCalendarAssociationCandidate(deps, {
      candidateId: personRow.candidateId,
      action: "approve",
      actor: "justin",
      mutationId: "mut-missing",
      edits: { personId: null },
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.reason, "blocked");
    assert.equal((await writer.listLinks()).length, 0);

    const approvedPerson = await reviewCalendarAssociationCandidate(deps, {
      candidateId: personRow.candidateId,
      action: "approve",
      actor: "justin",
      mutationId: "mut-person",
    });
    assert.equal(approvedPerson.ok, true);
    if (approvedPerson.ok) {
      assert.equal(approvedPerson.status, "applied");
      assert.equal(approvedPerson.appliedRecordKind, "source_link");
      assert.equal(approvedPerson.record.reviewStatus, "approved");
      assert.equal(approvedPerson.record.canonical, false);
    }
    const links = await writer.listLinks();
    assert.equal(links.length, 1);
    assert.equal(links[0]?.entityKind, "person");
    assert.equal(links[0]?.entityId, "person-ada");
    const mappings = await writer.listParticipantMappings();
    assert.equal(mappings.length, 1);
    assert.equal(mappings[0]?.personId, "person-ada");

    const approvedProject = await reviewCalendarAssociationCandidate(deps, {
      candidateId: projectRow.candidateId,
      action: "approve",
      actor: "justin",
      mutationId: "mut-project",
    });
    assert.equal(approvedProject.ok, true);
    assert.equal((await writer.listLinks()).length, 2);
    assert.ok(
      (await writer.listLinks()).some(
        (row) => row.entityKind === "project" && row.entityId === "proj-ada",
      ),
    );
  });

  it("does not write when discarded and does not mint People or create Open Jobs", async () => {
    const store = new InMemoryCandidateStore();
    const writer = new InMemoryCalendarAssociationWriter();
    const proposed = proposeCalendarAssociationCandidates({
      createdAt: NOW,
      world: world({
        people: [
          {
            personId: "person-ada",
            displayName: "Ada",
            emailHash: ADA_HASH,
            projectIds: [],
          },
        ],
      }),
      evidence: [
        calendarEventEvidence({
          calendar_id: "primary",
          calendar_event_id: "discard",
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
    for (const row of proposed.candidates) await store.put(row);
    const row = proposed.candidates[0];
    assert.ok(row);
    const discarded = await reviewCalendarAssociationCandidate(
      {
        nowIso: () => NOW,
        candidates: store,
        writer,
        getPersonName: async () => "Ada",
        getProjectTitle: async () => null,
      },
      {
        candidateId: row.candidateId,
        action: "discard",
        actor: "justin",
        mutationId: "mut-discard",
        edits: { personId: "person-ada" },
      },
    );
    assert.equal(discarded.ok, true);
    if (discarded.ok) assert.equal(discarded.status, "discarded");
    assert.equal((await writer.listLinks()).length, 0);
    assert.equal((await writer.listParticipantMappings()).length, 0);
    const stored = await store.get(row.candidateId);
    assert.equal(stored?.reviewStatus, "discarded");
    assert.equal(stored?.canonical, false);
  });

  it("preserves founder approval across Calendar reprocess", async () => {
    const store = new InMemoryCandidateStore();
    const writer = new InMemoryCalendarAssociationWriter();
    const input = {
      createdAt: NOW,
      world: world({
        projects: [
          {
            projectId: "proj-ada",
            title: "Ada ring",
            cadJobNumber: "CR5001024",
            orderNumber: null,
            personIds: [],
            founderApprovedCurrent: true,
          },
        ],
      }),
      evidence: [
        calendarEventEvidence({
          calendar_id: "primary",
          calendar_event_id: "persist",
          title: "CAD CR5001024",
        }),
      ],
    };
    const first = await ingestCalendarAssociationCandidates(store, input);
    const row = first.candidates.find((item) => item.candidateType === "project_association");
    assert.ok(row);
    const approved = await reviewCalendarAssociationCandidate(
      {
        nowIso: () => NOW,
        candidates: store,
        writer,
        getPersonName: async () => null,
        getProjectTitle: async () => "Ada ring",
      },
      {
        candidateId: row.candidateId,
        action: "approve",
        actor: "justin",
        mutationId: "mut-persist",
      },
    );
    assert.equal(approved.ok, true);
    const second = await ingestCalendarAssociationCandidates(store, input);
    assert.equal(second.insertedIds.length, 0);
    const reloaded = await store.get(row.candidateId);
    assert.equal(reloaded?.reviewStatus, "approved");
    assert.equal(reloaded?.canonical, false);
    assert.equal(reloaded?.automaticApply, false);
  });
});
