import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CLIENT_MEMORY_SOURCE_SYSTEM } from "../types";
import { ClientProfileView } from "../../../../app/executive-dashboard/concierge/components/client-profile-view";
import { ClientHistoryView } from "../../../../app/executive-dashboard/concierge/components/client-history-view";
import {
  composePersonCockpit,
  listPersonSourceHistoryFromSnapshot,
  partitionCockpitProjects,
} from "./cockpit";
import {
  emptyReadSnapshot,
  fact,
  note,
  personProfile,
  projectHistory,
  projectProfile,
  relationship,
  wish,
} from "./fixtures";
import { createInMemoryClientMemoryReader } from "./reader";
import {
  CLIENT_MEMORY_COCKPIT_NOTE_LIMIT,
  CLIENT_MEMORY_HISTORY_PAGE_SIZE,
  CLIENT_MEMORY_PROJECT_PREVIEW_LIMIT,
  COCKPIT_MANUAL_SOURCE_SYSTEM,
} from "./types";

const READ_DIR = dirname(fileURLToPath(import.meta.url));

describe("Person memory cockpit", () => {
  it("does not put an imported archive on the cockpit", () => {
    const person = personProfile({ displayName: "A. Achedekal" });
    const imported = Array.from({ length: 40 }, (_, i) =>
      note({
        personId: person.personId,
        createdAt: `2024-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
        text: `imported-archive-${i}`,
      }),
    );
    const manual = Array.from({ length: 8 }, (_, i) =>
      note({
        personId: person.personId,
        sourceSystem: COCKPIT_MANUAL_SOURCE_SYSTEM,
        createdAt: `2026-08-${String(10 + i).padStart(2, "0")}T00:00:00.000Z`,
        text: `founder-note-${i}`,
      }),
    );
    const composed = composePersonCockpit(
      {
        ...emptyReadSnapshot(),
        profiles: [person],
        sourceNotes: [...imported, ...manual],
      },
      person.personId,
    );
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    assert.equal(
      composed.cockpit.recentManualNotes.length,
      CLIENT_MEMORY_COCKPIT_NOTE_LIMIT,
    );
    assert.equal(
      composed.cockpit.recentManualNotes.every(
        (row) => row.sourceSystem === COCKPIT_MANUAL_SOURCE_SYSTEM,
      ),
      true,
    );
    assert.equal(composed.cockpit.history.noteCount, 48);
    const html = renderToStaticMarkup(
      createElement(ClientProfileView, { cockpit: composed.cockpit }),
    );
    assert.doesNotMatch(html, /imported-archive-/);
    assert.doesNotMatch(html, />Recent notes</i);
    assert.match(html, /founder-note-7/);
    assert.match(html, /History \/ Sources/);
    assert.match(html, /48 source notes/);
    assert.match(html, /\/history/);
  });

  it("does not label imported projects Current and collapses extras", () => {
    const person = personProfile({ displayName: "A. Achedekal" });
    const projects = Array.from({ length: 5 }, (_, i) =>
      projectProfile({
        displayTitle: `Imported project ${i + 1}`,
        importRowKey: `continuum-reconciliation-v3:ReconciledProjects:${i + 1}`,
      }),
    );
    const composed = composePersonCockpit(
      {
        ...emptyReadSnapshot(),
        profiles: [person],
        relationships: projects.map((project) =>
          relationship({
            fromEntityId: person.personId,
            toEntityId: project.projectId,
          }),
        ),
        projectProfiles: projects,
        projectHistories: projects.map((project) =>
          projectHistory({
            projectId: project.projectId,
            cadJobNumber: `CAD-${project.projectId.slice(0, 4)}`,
          }),
        ),
      },
      person.personId,
    );
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    assert.equal(composed.cockpit.projects.length, 5);
    assert.equal(
      composed.cockpit.projects.every((row) => row.imported),
      true,
    );
    const { preview, remaining } = partitionCockpitProjects(
      composed.cockpit.projects,
    );
    assert.equal(preview.length, CLIENT_MEMORY_PROJECT_PREVIEW_LIMIT);
    assert.equal(remaining.length, 2);
    const html = renderToStaticMarkup(
      createElement(ClientProfileView, { cockpit: composed.cockpit }),
    );
    assert.match(html, /Project Books/);
    assert.match(html, /Imported project 1/);
    assert.match(html, /Imported project 5/);
    assert.doesNotMatch(html, /Imported or other projects/);
    assert.doesNotMatch(html, />Current</);
    assert.doesNotMatch(html, /Current project/i);
    assert.doesNotMatch(html, /Waiting on Client|Waiting on Hourglass|Open Jobs/i);
    assert.doesNotMatch(html, />Closed</);
    assert.doesNotMatch(html, />Completed</);
  });

  it("resolves spouse and referral counterpart names without UUIDs", () => {
    const person = personProfile({ displayName: "Sarah Miller" });
    const spouse = personProfile({ displayName: "David Miller" });
    const referrer = personProfile({ displayName: "Elena Rossi" });
    const composed = composePersonCockpit(
      {
        ...emptyReadSnapshot(),
        profiles: [person, spouse, referrer],
        relationships: [
          relationship({
            fromEntityId: person.personId,
            toEntityId: spouse.personId,
            kind: "spouse",
          }),
          relationship({
            fromEntityId: referrer.personId,
            toEntityId: person.personId,
            kind: "referral",
          }),
          relationship({
            fromEntityId: person.personId,
            toEntityId: spouse.personId,
            kind: "spouse",
            status: "ended",
          }),
        ],
      },
      person.personId,
    );
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    assert.deepEqual(
      composed.cockpit.relationships.map((row) => row.counterpartName).sort(),
      ["David Miller", "Elena Rossi"],
    );
    const html = renderToStaticMarkup(
      createElement(ClientProfileView, { cockpit: composed.cockpit }),
    );
    assert.match(html, /David Miller/);
    assert.match(html, /Elena Rossi/);
    assert.match(html, /Spouse/);
    assert.match(html, /Referral/);
    assert.doesNotMatch(html, new RegExp(spouse.personId, "i"));
    assert.doesNotMatch(html, /client-project/i);
  });

  it("keeps project specs attached to the correct project", () => {
    const person = personProfile({ displayName: "Sarah Miller" });
    const oval = projectProfile({ displayTitle: "Oval ring" });
    const band = projectProfile({ displayTitle: "Wedding band" });
    const composed = composePersonCockpit(
      {
        ...emptyReadSnapshot(),
        profiles: [person],
        relationships: [
          relationship({
            fromEntityId: person.personId,
            toEntityId: oval.projectId,
          }),
          relationship({
            fromEntityId: person.personId,
            toEntityId: band.projectId,
          }),
        ],
        projectProfiles: [oval, band],
        projectHistories: [
          projectHistory({
            projectId: oval.projectId,
            cadJobNumber: "CAD-OVAL",
            metal: "yellow-gold",
          }),
          projectHistory({
            projectId: band.projectId,
            cadJobNumber: "CAD-BAND",
            metal: "platinum",
          }),
        ],
      },
      person.personId,
    );
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    const ovalRead = composed.cockpit.projects.find(
      (row) => row.profile.projectId === oval.projectId,
    );
    const bandRead = composed.cockpit.projects.find(
      (row) => row.profile.projectId === band.projectId,
    );
    assert.equal(ovalRead?.internalHistory?.cadJobNumber, "CAD-OVAL");
    assert.equal(ovalRead?.internalHistory?.metal, "yellow-gold");
    assert.equal(bandRead?.internalHistory?.cadJobNumber, "CAD-BAND");
    assert.equal(bandRead?.internalHistory?.metal, "platinum");
  });

  it("keeps 20 vs 20,000 source archives out of the cockpit shape", () => {
    const person = personProfile({ displayName: "Sarah Miller" });
    const archive = Array.from({ length: 20_000 }, (_, i) =>
      note({
        personId: person.personId,
        createdAt: `2020-01-01T00:00:00.${String(i).padStart(3, "0")}Z`,
        text: `archive-${i}`,
      }),
    );
    const composed = composePersonCockpit(
      {
        ...emptyReadSnapshot(),
        profiles: [person],
        sourceNotes: archive,
      },
      person.personId,
    );
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    assert.equal(composed.cockpit.recentManualNotes.length, 0);
    assert.equal(composed.cockpit.history.noteCount, 20_000);
    const html = renderToStaticMarkup(
      createElement(ClientProfileView, { cockpit: composed.cockpit }),
    );
    assert.doesNotMatch(html, /archive-19999|archive-0/);
    assert.match(html, /20000 source notes/);
  });

  it("does not bleed another person's notes, facts, or project specs", () => {
    const sarah = personProfile({ displayName: "Sarah Miller" });
    const other = personProfile({ displayName: "Other Person" });
    const sarahProject = projectProfile({ displayTitle: "Sarah ring" });
    const otherProject = projectProfile({ displayTitle: "Other ring" });
    const composed = composePersonCockpit(
      {
        ...emptyReadSnapshot(),
        profiles: [sarah, other],
        relationships: [
          relationship({
            fromEntityId: sarah.personId,
            toEntityId: sarahProject.projectId,
          }),
          relationship({
            fromEntityId: other.personId,
            toEntityId: otherProject.projectId,
          }),
        ],
        projectProfiles: [sarahProject, otherProject],
        projectHistories: [
          projectHistory({
            projectId: sarahProject.projectId,
            cadJobNumber: "CAD-SARAH",
          }),
          projectHistory({
            projectId: otherProject.projectId,
            cadJobNumber: "CAD-OTHER",
          }),
        ],
        facts: [
          fact({
            personId: sarah.personId,
            factType: "ring-size",
            status: "current",
            value: "6",
          }),
          fact({
            personId: other.personId,
            factType: "ring-size",
            status: "current",
            value: "9",
          }),
        ],
        sourceNotes: [
          note({
            personId: sarah.personId,
            sourceSystem: COCKPIT_MANUAL_SOURCE_SYSTEM,
            createdAt: "2026-08-20T00:00:00.000Z",
            text: "Sarah prefers mornings.",
          }),
          note({
            personId: other.personId,
            sourceSystem: COCKPIT_MANUAL_SOURCE_SYSTEM,
            createdAt: "2026-08-21T00:00:00.000Z",
            text: "Other secret note",
          }),
        ],
      },
      sarah.personId,
    );
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    assert.equal(composed.cockpit.projects.length, 1);
    assert.equal(composed.cockpit.projects[0]?.internalHistory?.cadJobNumber, "CAD-SARAH");
    assert.equal(composed.cockpit.recentManualNotes[0]?.noteText, "Sarah prefers mornings.");
    const html = renderToStaticMarkup(
      createElement(ClientProfileView, { cockpit: composed.cockpit }),
    );
    assert.match(html, /Sarah prefers mornings/);
    assert.doesNotMatch(html, /Other secret note|CAD-OTHER|Other ring/);
    assert.doesNotMatch(html, />9</);
  });

  it("does not render Human Intake raw text or digital-card payloads", () => {
    const person = personProfile({ displayName: "Sarah Miller" });
    const composed = composePersonCockpit(
      { ...emptyReadSnapshot(), profiles: [person] },
      person.personId,
    );
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    const html = renderToStaticMarkup(
      createElement(ClientProfileView, { cockpit: composed.cockpit }),
    );
    assert.doesNotMatch(html, /raw_text|parsed_text|submitted_contact|continuum_human_sources/i);
    assert.doesNotMatch(html, /identity_exchange|digital.card.exchange/i);
    const source = readFileSync(join(READ_DIR, "cockpit.ts"), "utf8");
    assert.doesNotMatch(source, /continuum_human_sources|raw_text|continuum_identity_exchanges/);
    assert.doesNotMatch(source, /Waiting on|Open Jobs|loadSnapshot/);
  });

  it("pages History/Sources independently of the cockpit", () => {
    const person = personProfile({ displayName: "Sarah Miller" });
    const notes = Array.from({ length: 25 }, (_, i) =>
      note({
        personId: person.personId,
        createdAt: `2026-07-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
        text: `history-${i}`,
      }),
    );
    const snapshot = {
      ...emptyReadSnapshot(),
      profiles: [person],
      sourceNotes: notes,
    };
    const page1 = listPersonSourceHistoryFromSnapshot(snapshot, person.personId, {
      page: 1,
    });
    const page2 = listPersonSourceHistoryFromSnapshot(snapshot, person.personId, {
      page: 2,
    });
    assert.equal(page1.ok, true);
    assert.equal(page2.ok, true);
    if (!page1.ok || !page2.ok) return;
    assert.equal(page1.history.notes.length, CLIENT_MEMORY_HISTORY_PAGE_SIZE);
    assert.equal(page2.history.notes.length, 5);
    assert.equal(page1.history.total, 25);
    const html = renderToStaticMarkup(
      createElement(ClientHistoryView, { history: page1.history }),
    );
    assert.match(html, /History \/ Sources/);
    assert.match(html, /All sources/);
    assert.match(html, /Page 1 of 2/);
    assert.match(html, /Trashed/);
    assert.doesNotMatch(html, /Waiting on Client|Waiting on Hourglass|Open Jobs/);
  });

  it("shows only kept founder notes on the cockpit and keeps absorbed evidence in History", () => {
    const person = personProfile({ displayName: "Sarah Miller" });
    const kept = note({
      personId: person.personId,
      sourceSystem: COCKPIT_MANUAL_SOURCE_SYSTEM,
      createdAt: "2026-08-20T00:00:00.000Z",
      text: "Founder kept note",
      lifecycleStatus: "kept",
    });
    const inbox = note({
      personId: person.personId,
      sourceSystem: COCKPIT_MANUAL_SOURCE_SYSTEM,
      createdAt: "2026-08-21T00:00:00.000Z",
      text: "Inbox capture",
      lifecycleStatus: "inbox",
    });
    const absorbed = note({
      personId: person.personId,
      createdAt: "2026-08-19T00:00:00.000Z",
      text: "Imported absorbed evidence",
      lifecycleStatus: "absorbed",
    });
    const trashed = note({
      personId: person.personId,
      sourceSystem: COCKPIT_MANUAL_SOURCE_SYSTEM,
      createdAt: "2026-08-18T00:00:00.000Z",
      text: "Trashed founder note",
      lifecycleStatus: "trashed",
    });
    const snapshot = {
      ...emptyReadSnapshot(),
      profiles: [person],
      sourceNotes: [kept, inbox, absorbed, trashed],
    };
    const composed = composePersonCockpit(snapshot, person.personId);
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    assert.deepEqual(
      composed.cockpit.recentManualNotes.map((row) => row.noteText),
      ["Founder kept note"],
    );
    assert.equal(composed.cockpit.history.noteCount, 2);
    const html = renderToStaticMarkup(
      createElement(ClientProfileView, { cockpit: composed.cockpit }),
    );
    assert.match(html, /Founder kept note/);
    assert.match(html, />Edit</);
    assert.match(html, />Move</);
    assert.match(html, />Trash</);
    assert.doesNotMatch(html, /Inbox capture|Imported absorbed evidence|Trashed founder note/);
    const history = listPersonSourceHistoryFromSnapshot(snapshot, person.personId);
    assert.equal(history.ok, true);
    if (!history.ok) return;
    assert.deepEqual(
      history.history.notes.map((row) => row.noteText).sort(),
      ["Founder kept note", "Imported absorbed evidence"],
    );
    const trashedHistory = listPersonSourceHistoryFromSnapshot(
      snapshot,
      person.personId,
      { lifecycle: "trashed" },
    );
    assert.equal(trashedHistory.ok, true);
    if (!trashedHistory.ok) return;
    assert.equal(trashedHistory.history.notes[0]?.noteText, "Trashed founder note");
    const historyHtml = renderToStaticMarkup(
      createElement(ClientHistoryView, { history: trashedHistory.history }),
    );
    assert.match(historyHtml, /Restore/);
    assert.doesNotMatch(historyHtml, /Waiting on Client|Open Jobs/);
  });

  it("exposes cockpit methods on the in-memory reader", async () => {
    const person = personProfile({ displayName: "Sarah Miller" });
    const reader = createInMemoryClientMemoryReader({
      ...emptyReadSnapshot(),
      profiles: [person],
      wishes: [
        wish({
          personId: person.personId,
          description: "Quiet yellow gold",
          status: "active",
        }),
      ],
    });
    const cockpit = await reader.getPersonCockpit(person.personId);
    assert.equal(cockpit.ok, true);
    if (!cockpit.ok) return;
    assert.equal(cockpit.cockpit.wishes[0]?.description, "Quiet yellow gold");
    const missing = await reader.getPersonCockpit("missing");
    assert.deepEqual(missing, { ok: false, reason: "not-found" });
  });
});

describe("Person cockpit query contract", () => {
  it("keeps the primary cockpit query bounded and archive-size independent", () => {
    const source = readFileSync(join(READ_DIR, "supabase.ts"), "utf8");
    assert.match(source, /loadPersonCockpitSnapshot/);
    assert.match(source, /CLIENT_MEMORY_COCKPIT_NOTE_LIMIT/);
    assert.match(source, /COCKPIT_MANUAL_SOURCE_SYSTEM/);
    assert.match(source, /lifecycle_status/);
    assert.match(source, /countPersonNotes/);
    assert.match(source, /head: true/);
    assert.match(source, /\.in\("person_id", counterpartIds\)/);
    assert.match(source, /\.range\(input\.from, input\.to\)/);
    assert.doesNotMatch(source, /project-desk\/compose|loadSnapshot\(/);
    assert.doesNotMatch(source, /continuum_human_sources|raw_text|parsed_text/);
    assert.doesNotMatch(source, /continuum_gmail_messages|continuum_attention_items/);
    assert.doesNotMatch(source, /continuum_identity_exchanges|submitted_contact/);
    const start = source.indexOf("private async loadPersonCockpitSnapshot");
    const end = source.indexOf("private async loadPersonSourceHistory");
    assert.ok(start >= 0 && end > start);
    const cockpitQuery = source.slice(start, end);
    assert.doesNotMatch(
      cockpitQuery,
      /\.or\(`person_id\.eq\.\$\{trimmed\},project_id\.in/,
    );
    assert.match(cockpitQuery, /read-project-book-notes-failed/);
    assert.match(
      cockpitQuery,
      /\.limit\(CLIENT_MEMORY_COCKPIT_NOTE_LIMIT\)/,
    );
  });
});
