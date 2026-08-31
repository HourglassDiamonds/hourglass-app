import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLIENT_MEMORY_SOURCE_SYSTEM, type ProjectHistory } from "../types";
import {
  emptyReadSnapshot,
  note,
  personProfile,
  projectProfile,
  relationship,
} from "../read/fixtures";
import { composePersonCockpit } from "../read/cockpit";
import { composePersonProjectBooks } from "./compose";
import { projectBookDefaultExpanded } from "./presentation";

const NOW = "2026-08-22T12:00:00.000Z";
const PERSON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STUART_ID = "dddddddd-4444-4444-8444-ddddddddddd4";
const MR_STUART_ID = "eeeeeeee-5555-4555-8555-eeeeeeeeeee5";
const JESSE_A = "11111111-aaaa-4aaa-8aaa-111111111111";
const JESSE_B = "22222222-bbbb-4bbb-8bbb-222222222222";
const UNLINKED_ID = "99999999-9999-4999-8999-999999999999";

function history(
  projectId: string,
  extra: Partial<ProjectHistory> = {},
): ProjectHistory {
  return {
    projectId,
    cadJobNumber: null,
    orderNumber: null,
    gmailThreadId: null,
    matchJudgment: null,
    matchJudgmentRaw: null,
    fingerSize: null,
    metal: null,
    centerStone: null,
    diamondSupplyNotes: null,
    sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
    createdAt: NOW,
    updatedAt: NOW,
    ...extra,
  };
}

function personSnapshot() {
  const person = personProfile({
    personId: PERSON_ID,
    displayName: "Stuart Household",
  });
  return { person, snapshotBase: { ...emptyReadSnapshot(), profiles: [person] } };
}

describe("Person Project Books read model", () => {
  it("A. returns no books for a Person with zero linked Projects", () => {
    const { person, snapshotBase } = personSnapshot();
    const books = composePersonProjectBooks(snapshotBase, person.personId);
    assert.deepEqual(books, []);
    assert.equal(projectBookDefaultExpanded(books.length), false);
  });

  it("B. returns one independent book for a Person with one Project", () => {
    const { person, snapshotBase } = personSnapshot();
    const project = projectProfile({
      projectId: STUART_ID,
      displayTitle: "STUART",
    });
    const books = composePersonProjectBooks(
      {
        ...snapshotBase,
        relationships: [
          relationship({
            fromEntityId: person.personId,
            toEntityId: project.projectId,
          }),
        ],
        projectProfiles: [project],
        projectHistories: [
          history(project.projectId, {
            cadJobNumber: "C007157",
            orderNumber: "SP3066",
          }),
        ],
      },
      person.personId,
    );
    assert.equal(books.length, 1);
    assert.equal(books[0]?.projectId, STUART_ID);
    assert.equal(books[0]?.cadIdentifier, "C007157");
    assert.equal(projectBookDefaultExpanded(books.length), true);
  });

  it("C. returns one book per linked Project", () => {
    const { person, snapshotBase } = personSnapshot();
    const stuart = projectProfile({ projectId: STUART_ID, displayTitle: "STUART" });
    const mr = projectProfile({
      projectId: MR_STUART_ID,
      displayTitle: "MR-STUART",
    });
    const books = composePersonProjectBooks(
      {
        ...snapshotBase,
        relationships: [
          relationship({
            fromEntityId: person.personId,
            toEntityId: stuart.projectId,
          }),
          relationship({
            fromEntityId: person.personId,
            toEntityId: mr.projectId,
          }),
        ],
        projectProfiles: [stuart, mr],
        projectHistories: [history(STUART_ID), history(MR_STUART_ID)],
      },
      person.personId,
    );
    assert.equal(books.length, 2);
    assert.deepEqual(
      new Set(books.map((row) => row.projectId)),
      new Set([STUART_ID, MR_STUART_ID]),
    );
    assert.equal(projectBookDefaultExpanded(books.length), false);
  });

  it("D. keeps STUART and MR-STUART isolated on the same Person", () => {
    const { person, snapshotBase } = personSnapshot();
    const snapshot = {
      ...snapshotBase,
      relationships: [
        relationship({ fromEntityId: person.personId, toEntityId: STUART_ID }),
        relationship({ fromEntityId: person.personId, toEntityId: MR_STUART_ID }),
      ],
      projectProfiles: [
        projectProfile({ projectId: STUART_ID, displayTitle: "STUART" }),
        projectProfile({ projectId: MR_STUART_ID, displayTitle: "MR-STUART" }),
      ],
      projectHistories: [
        history(STUART_ID, {
          cadJobNumber: "C007157",
          orderNumber: "SP3066",
          fingerSize: "212",
          metal: "platinum",
          gmailThreadId: "thread-stuart",
        }),
        history(MR_STUART_ID, {
          cadJobNumber: "C007040",
          orderNumber: "SP2976",
          fingerSize: "70",
          metal: "gold",
          gmailThreadId: "thread-mr-stuart",
        }),
      ],
      sourceNotes: [
        note({
          personId: person.personId,
          projectId: STUART_ID,
          createdAt: "2026-08-20T00:00:00.000Z",
          text: "STUART platinum notes",
        }),
        note({
          personId: person.personId,
          projectId: MR_STUART_ID,
          createdAt: "2026-08-21T00:00:00.000Z",
          text: "MR-STUART gold notes",
        }),
      ],
    };
    const books = composePersonProjectBooks(snapshot, person.personId);
    const stuart = books.find((row) => row.projectId === STUART_ID);
    const mr = books.find((row) => row.projectId === MR_STUART_ID);
    assert.ok(stuart);
    assert.ok(mr);
    assert.equal(stuart.cadIdentifier, "C007157");
    assert.equal(mr.cadIdentifier, "C007040");
    assert.equal(stuart.overview.fingerSize, "212");
    assert.equal(mr.overview.fingerSize, "70");
    assert.deepEqual(
      stuart.history.map((row) => row.noteText),
      ["STUART platinum notes"],
    );
    assert.deepEqual(
      mr.history.map((row) => row.noteText),
      ["MR-STUART gold notes"],
    );
    assert.equal(
      stuart.history.some((row) => row.noteText.includes("MR-STUART")),
      false,
    );
    assert.equal(
      mr.itemsAndSpecs.specs.some((row) => row.value === "platinum"),
      false,
    );
    assert.equal(stuart.cadDesign.cadIdentifier, "C007157");
    assert.equal(mr.cadDesign.cadIdentifier, "C007040");
  });

  it("F/J. treats Project ID as identity when titles match", () => {
    const { person, snapshotBase } = personSnapshot();
    const books = composePersonProjectBooks(
      {
        ...snapshotBase,
        relationships: [
          relationship({ fromEntityId: person.personId, toEntityId: JESSE_A }),
          relationship({ fromEntityId: person.personId, toEntityId: JESSE_B }),
        ],
        projectProfiles: [
          projectProfile({ projectId: JESSE_A, displayTitle: "Jesse R." }),
          projectProfile({ projectId: JESSE_B, displayTitle: "Jesse R." }),
        ],
        projectHistories: [
          history(JESSE_A, { cadJobNumber: "C024594" }),
          history(JESSE_B, { cadJobNumber: "C025088" }),
        ],
      },
      person.personId,
    );
    assert.equal(books.length, 2);
    assert.equal(books[0]?.title, "Jesse R.");
    assert.equal(books[1]?.title, "Jesse R.");
    assert.notEqual(books[0]?.projectId, books[1]?.projectId);
    assert.deepEqual(
      new Set(books.map((row) => row.projectId)),
      new Set([JESSE_A, JESSE_B]),
    );
    assert.deepEqual(
      new Set(books.map((row) => row.cadIdentifier)),
      new Set(["C024594", "C025088"]),
    );
  });

  it("G. leaves unknown specs empty instead of inferring item kind", () => {
    const { person, snapshotBase } = personSnapshot();
    const books = composePersonProjectBooks(
      {
        ...snapshotBase,
        relationships: [
          relationship({ fromEntityId: person.personId, toEntityId: STUART_ID }),
        ],
        projectProfiles: [
          projectProfile({ projectId: STUART_ID, displayTitle: "Oval ring" }),
        ],
        projectHistories: [history(STUART_ID)],
      },
      person.personId,
    );
    assert.equal(books[0]?.itemsAndSpecs.itemType, null);
    assert.deepEqual(books[0]?.itemsAndSpecs.specs, []);
    assert.equal(books[0]?.cadIdentifier, null);
    assert.equal(books[0]?.overview.metal, null);
    assert.deepEqual(books[0]?.decisionsAndApprovals, []);
    assert.equal(books[0]?.artifacts.connected, false);
  });

  it("H. keeps recovered order conflicts out of canonical display", () => {
    const { person, snapshotBase } = personSnapshot();
    const books = composePersonProjectBooks(
      {
        ...snapshotBase,
        relationships: [
          relationship({ fromEntityId: person.personId, toEntityId: STUART_ID }),
        ],
        projectProfiles: [
          projectProfile({ projectId: STUART_ID, displayTitle: "STUART" }),
        ],
        projectHistories: [
          history(STUART_ID, { orderNumber: "SP3066", cadJobNumber: "C007157" }),
        ],
      },
      person.personId,
      { recoveredOrderConflicts: { [STUART_ID]: ["SP9999"] } },
    );
    assert.equal(books[0]?.storedOrderIdentifier, "SP3066");
    assert.equal(books[0]?.overview.storedOrderIdentifier, "SP3066");
    assert.equal(books[0]?.commercial.storedOrderIdentifier, "SP3066");
    assert.equal(books[0]?.commercial.founderReviewRequired, true);
  });

  it("I. does not attach unlinked Projects to the Person", () => {
    const { person, snapshotBase } = personSnapshot();
    const books = composePersonProjectBooks(
      {
        ...snapshotBase,
        relationships: [
          relationship({ fromEntityId: person.personId, toEntityId: STUART_ID }),
        ],
        projectProfiles: [
          projectProfile({ projectId: STUART_ID, displayTitle: "STUART" }),
          projectProfile({
            projectId: UNLINKED_ID,
            displayTitle: "Unlinked Book",
          }),
        ],
        projectHistories: [
          history(STUART_ID, { cadJobNumber: "C007157" }),
          history(UNLINKED_ID, { cadJobNumber: "C025088", metal: "borrowed" }),
        ],
      },
      person.personId,
    );
    assert.equal(books.length, 1);
    assert.equal(books[0]?.projectId, STUART_ID);
    assert.equal(
      books.some((row) => row.projectId === UNLINKED_ID),
      false,
    );
    assert.equal(
      books.some((row) => row.title === "Unlinked Book"),
      false,
    );
  });

  it("orders books by latest project-scoped history, then projectId", () => {
    const { person, snapshotBase } = personSnapshot();
    const older = projectProfile({
      projectId: STUART_ID,
      displayTitle: "Older title",
    });
    const newer = projectProfile({
      projectId: MR_STUART_ID,
      displayTitle: "Newer title",
    });
    older.updatedAt = "2026-01-01T00:00:00.000Z";
    newer.updatedAt = "2026-02-01T00:00:00.000Z";
    const books = composePersonProjectBooks(
      {
        ...snapshotBase,
        relationships: [
          relationship({ fromEntityId: person.personId, toEntityId: STUART_ID }),
          relationship({
            fromEntityId: person.personId,
            toEntityId: MR_STUART_ID,
          }),
        ],
        projectProfiles: [older, newer],
        projectHistories: [history(STUART_ID), history(MR_STUART_ID)],
        sourceNotes: [
          note({
            personId: person.personId,
            projectId: STUART_ID,
            createdAt: "2026-08-30T00:00:00.000Z",
            text: "later STUART source",
          }),
          note({
            personId: person.personId,
            projectId: MR_STUART_ID,
            createdAt: "2026-08-01T00:00:00.000Z",
            text: "earlier MR source",
          }),
        ],
      },
      person.personId,
    );
    assert.deepEqual(
      books.map((row) => row.projectId),
      [STUART_ID, MR_STUART_ID],
    );
  });

  it("attaches project books on the Person cockpit", () => {
    const { person, snapshotBase } = personSnapshot();
    const composed = composePersonCockpit(
      {
        ...snapshotBase,
        relationships: [
          relationship({ fromEntityId: person.personId, toEntityId: STUART_ID }),
        ],
        projectProfiles: [
          projectProfile({ projectId: STUART_ID, displayTitle: "STUART" }),
        ],
        projectHistories: [history(STUART_ID, { cadJobNumber: "C007157" })],
      },
      person.personId,
    );
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    assert.equal(composed.cockpit.projectBooks.length, 1);
    assert.equal(composed.cockpit.projectBooks[0]?.projectId, STUART_ID);
    assert.equal(composed.cockpit.projectBooks[0]?.projectKind, null);
  });

  it("exposes canonical Project Kind independently per Project Book", () => {
    const { person, snapshotBase } = personSnapshot();
    const books = composePersonProjectBooks(
      {
        ...snapshotBase,
        relationships: [
          relationship({ fromEntityId: person.personId, toEntityId: STUART_ID }),
          relationship({ fromEntityId: person.personId, toEntityId: MR_STUART_ID }),
        ],
        projectProfiles: [
          projectProfile({
            projectId: STUART_ID,
            displayTitle: "STUART",
            projectKind: "repair_service",
          }),
          projectProfile({
            projectId: MR_STUART_ID,
            displayTitle: "MR-STUART",
            projectKind: "custom_new_jewelry",
          }),
          projectProfile({
            projectId: UNLINKED_ID,
            displayTitle: "Chicken ring",
            projectKind: "other",
          }),
        ],
        projectHistories: [
          history(STUART_ID),
          history(MR_STUART_ID),
          history(UNLINKED_ID),
        ],
      },
      person.personId,
    );
    const stuart = books.find((row) => row.projectId === STUART_ID);
    const mr = books.find((row) => row.projectId === MR_STUART_ID);
    assert.equal(stuart?.projectKind, "repair_service");
    assert.equal(mr?.projectKind, "custom_new_jewelry");
    assert.equal(stuart?.overview.projectKind, "repair_service");
    assert.equal(mr?.overview.projectKind, "custom_new_jewelry");
    assert.equal(
      books.some((row) => row.projectId === UNLINKED_ID),
      false,
    );
  });

  it("does not infer Project Kind from title and treats Other as distinct from unset", () => {
    const { person, snapshotBase } = personSnapshot();
    const books = composePersonProjectBooks(
      {
        ...snapshotBase,
        relationships: [
          relationship({ fromEntityId: person.personId, toEntityId: STUART_ID }),
          relationship({ fromEntityId: person.personId, toEntityId: JESSE_A }),
        ],
        projectProfiles: [
          projectProfile({
            projectId: STUART_ID,
            displayTitle: "Chicken ring repair",
          }),
          projectProfile({
            projectId: JESSE_A,
            displayTitle: "Jesse R.",
            projectKind: "other",
          }),
        ],
        projectHistories: [history(STUART_ID), history(JESSE_A)],
      },
      person.personId,
    );
    const unset = books.find((row) => row.projectId === STUART_ID);
    const other = books.find((row) => row.projectId === JESSE_A);
    assert.equal(unset?.projectKind, null);
    assert.equal(unset?.overview.projectKind, null);
    assert.equal(other?.projectKind, "other");
  });
});
