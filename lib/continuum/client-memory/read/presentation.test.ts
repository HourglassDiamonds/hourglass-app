import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conciergeAddClientPath,
  conciergeAddNotePath,
  conciergeEditPersonPath,
  conciergeHistoryPath,
  conciergeProjectPath,
  conciergeProjectsPath,
  conciergeCohort1Path,
  conciergeCohort1ProjectPath,
  conciergeAddNotePickerPath,
  conciergeBirthdayPath,
  conciergeInboxNewPath,
  conciergeInboxPath,
  conciergeInboxSourcePath,
  conciergeCorrectProjectKindPath,
  conciergeCorrectProjectSpecPath,
  formatFactValue,
  formatLocation,
  historyFields,
  isPersonIdParam,
  isProjectIdParam,
  memoryReviewLabel,
  noteContextLabel,
  noteProjectTitle,
  noteSourceLabel,
  projectCountLabel,
  relationshipLabel,
  reviewIndicatorLabel,
  telHref,
} from "./presentation";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import type { LinkedProjectRead, PersonFact, SourceNoteSummary } from "./types";

describe("Concierge presentation", () => {
  it("formats location without empty parts", () => {
    assert.equal(
      formatLocation({
        id: "1",
        displayName: "Ada",
        givenName: "Ada",
        familyName: "Lovelace",
        organizationName: null,
        email: null,
        phone: null,
        streetAddress: null,
        city: "Miami",
        state: "FL",
        country: "US",
        postalCode: null,
        roles: ["client"],
      }),
      "Miami, FL, US",
    );
  });

  it("does not infer social relationship labels for client-project rows", () => {
    assert.equal(relationshipLabel("client-project"), null);
    assert.equal(relationshipLabel("spouse"), "Spouse");
  });

  it("keeps fact values human-readable and skips JSON objects", () => {
    const current: PersonFact = {
      id: "f1",
      personId: "p1",
      factType: "ring-size",
      value: "6.25",
      confidence: 1,
      verification: null,
      approvalStatus: "approved",
      status: "current",
      visibility: "internal-only",
      usagePermission: "unset",
      validFrom: null,
      validUntil: null,
      supersedesId: null,
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      createdAt: "2026-08-22T00:00:00.000Z",
      createdBy: "test",
    };
    assert.equal(formatFactValue(current), "6.25");
    assert.equal(formatFactValue({ ...current, value: { nested: true } }), null);
    assert.equal(
      formatFactValue({
        ...current,
        factType: "birthday",
        value: { calendar: "gregorian", month: 11, day: 12, year: null },
      }),
      "November 12",
    );
  });

  it("labels imported notes conservatively", () => {
    const note: SourceNoteSummary = {
      id: "n1",
      personId: "p1",
      projectId: null,
      contextLayer: "client",
      sourceSystem: CLIENT_MEMORY_SOURCE_SYSTEM,
      sourceArtifact: "continuum-reconciliation-v3",
      sourceSheet: "Reconciled Projects",
      sourceField: "Notes",
      gmailThreadId: null,
      noteText: "hello",
      createdAt: "2026-08-22T00:00:00.000Z",
      lifecycleStatus: "absorbed",
    };
    assert.equal(noteSourceLabel(note), "Historical client record");
    assert.doesNotMatch(noteSourceLabel(note), /import_row_key|xlsx|Reconciled/i);
    assert.equal(noteContextLabel(note.contextLayer), "Client");
    assert.equal(
      noteSourceLabel({ ...note, sourceSystem: "concierge-manual" }),
      "Concierge",
    );
    assert.doesNotMatch(
      noteSourceLabel({ ...note, sourceSystem: "concierge-manual" }),
      /concierge-manual|manual-note/,
    );
    assert.equal(
      noteProjectTitle({ ...note, projectId: "proj-1" }, { "proj-1": "Oval ring" }),
      "Oval ring",
    );
    assert.equal(noteProjectTitle(note, { "proj-1": "Oval ring" }), null);
  });

  it("omits empty project history fields and financial names", () => {
    const project: LinkedProjectRead = {
      profile: {
        projectId: "proj-1",
        displayTitle: "Oval ring",
        visibility: "internal-only",
      },
      internalHistory: {
        cadJobNumber: "CAD-1",
        orderNumber: null,
        gmailThreadId: null,
        matchJudgment: "exact",
        fingerSize: "6",
        metal: null,
        centerStone: null,
        diamondSupplyNotes: null,
      },
    };
    const fields = historyFields(project);
    assert.deepEqual(
      fields.map((row) => row.label),
      ["CAD", "Finger size"],
    );
    assert.equal(fields.some((row) => /cost|margin|price/i.test(row.label)), false);
  });

  it("builds review and project count copy", () => {
    assert.equal(reviewIndicatorLabel(0), null);
    assert.equal(reviewIndicatorLabel(1), "Needs review · 1");
    assert.equal(projectCountLabel(2), "2 projects");
    assert.equal(memoryReviewLabel(1, 1), "2 memories need review");
    assert.equal(telHref("(305) 555-0100"), "tel:+13055550100");
    assert.equal(telHref("not-a-phone"), null);
    assert.equal(isPersonIdParam("not-a-uuid"), false);
    assert.equal(isPersonIdParam("eb2802bd-e312-471e-8582-8dbd5ad2e04b"), true);
    assert.equal(isProjectIdParam("not-a-uuid"), false);
    assert.equal(isProjectIdParam("eb2802bd-e312-471e-8582-8dbd5ad2e04b"), true);
    assert.equal(
      conciergeProjectPath("eb2802bd-e312-471e-8582-8dbd5ad2e04b"),
      "/executive-dashboard/concierge/projects/eb2802bd-e312-471e-8582-8dbd5ad2e04b",
    );
    assert.equal(conciergeProjectsPath(), "/executive-dashboard/concierge/projects");
    assert.equal(
      conciergeCohort1Path(),
      "/executive-dashboard/concierge/project-reconstruction/cohort-1",
    );
    assert.equal(
      conciergeCohort1ProjectPath("eb2802bd-e312-471e-8582-8dbd5ad2e04b"),
      "/executive-dashboard/concierge/project-reconstruction/cohort-1/eb2802bd-e312-471e-8582-8dbd5ad2e04b",
    );
    assert.doesNotMatch(
      conciergeProjectsPath(),
      /lifecycle/,
    );
  });

  it("keeps Add Note picker and person-note paths distinct", () => {
    assert.equal(
      conciergeAddNotePickerPath(),
      "/executive-dashboard/concierge/note/new",
    );
    assert.equal(
      conciergeAddNotePath("eb2802bd-e312-471e-8582-8dbd5ad2e04b"),
      "/executive-dashboard/concierge/client/eb2802bd-e312-471e-8582-8dbd5ad2e04b/note/new",
    );
    assert.equal(
      conciergeBirthdayPath("eb2802bd-e312-471e-8582-8dbd5ad2e04b"),
      "/executive-dashboard/concierge/client/eb2802bd-e312-471e-8582-8dbd5ad2e04b/birthday",
    );
    assert.equal(
      conciergeAddClientPath(),
      "/executive-dashboard/concierge/client/new",
    );
    assert.equal(
      conciergeEditPersonPath("eb2802bd-e312-471e-8582-8dbd5ad2e04b"),
      "/executive-dashboard/concierge/client/eb2802bd-e312-471e-8582-8dbd5ad2e04b/edit",
    );
    assert.equal(
      conciergeHistoryPath("eb2802bd-e312-471e-8582-8dbd5ad2e04b"),
      "/executive-dashboard/concierge/client/eb2802bd-e312-471e-8582-8dbd5ad2e04b/history",
    );
    assert.equal(
      conciergeHistoryPath("eb2802bd-e312-471e-8582-8dbd5ad2e04b", {
        page: 2,
        source: "concierge-manual",
      }),
      "/executive-dashboard/concierge/client/eb2802bd-e312-471e-8582-8dbd5ad2e04b/history?page=2&source=concierge-manual",
    );
    assert.equal(conciergeInboxPath(), "/executive-dashboard/concierge/inbox");
    assert.equal(conciergeInboxNewPath(), "/executive-dashboard/concierge/inbox/new");
    assert.equal(
      conciergeInboxSourcePath("eb2802bd-e312-471e-8582-8dbd5ad2e04b"),
      "/executive-dashboard/concierge/inbox/eb2802bd-e312-471e-8582-8dbd5ad2e04b",
    );
    assert.equal(
      conciergeCorrectProjectSpecPath(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "finger_size",
      ),
      "/executive-dashboard/concierge/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/correct/finger_size",
    );
    assert.equal(
      conciergeCorrectProjectKindPath("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      "/executive-dashboard/concierge/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/kind",
    );
    assert.notEqual(
      conciergeAddNotePickerPath(),
      conciergeAddNotePath("eb2802bd-e312-471e-8582-8dbd5ad2e04b"),
    );
  });
});
