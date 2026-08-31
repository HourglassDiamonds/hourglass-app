import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CLIENT_MEMORY_SOURCE_SYSTEM, type ProjectHistory } from "../types";
import { ClientProfileView } from "../../../../app/executive-dashboard/concierge/components/client-profile-view";
import { PersonProjectBooksSection } from "../../../../app/executive-dashboard/concierge/components/person-project-books";
import {
  emptyReadSnapshot,
  note,
  personProfile,
  projectProfile,
  relationship,
} from "../read/fixtures";
import { composePersonCockpit } from "../read/cockpit";
import { composePersonProjectBooks } from "./compose";
import {
  PROJECT_BOOK_EMPTY,
  PROJECT_BOOK_FOUNDER_REVIEW,
  PROJECT_BOOKS_EMPTY,
  projectBookPanelId,
  projectBookToggleId,
} from "./presentation";

const NOW = "2026-08-22T12:00:00.000Z";
const PERSON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STUART_ID = "dddddddd-4444-4444-8444-ddddddddddd4";
const MR_STUART_ID = "eeeeeeee-5555-4555-8555-eeeeeeeeeee5";
const JESSE_A = "11111111-aaaa-4aaa-8aaa-111111111111";
const JESSE_B = "22222222-bbbb-4bbb-8bbb-222222222222";
const UNLINKED_ID = "99999999-9999-4999-8999-999999999999";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

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

function person() {
  return personProfile({
    personId: PERSON_ID,
    displayName: "Stuart Household",
  });
}

function bookArticle(html: string, projectId: string): string {
  const token = `data-project-book="${projectId}"`;
  const tokenAt = html.indexOf(token);
  assert.ok(tokenAt >= 0, `missing project book ${projectId}`);
  const start = html.lastIndexOf("<article", tokenAt);
  const end = html.indexOf("</article>", tokenAt);
  assert.ok(start >= 0 && end > start);
  return html.slice(start, end + "</article>".length);
}

function renderBooks(
  snapshot: ReturnType<typeof emptyReadSnapshot> & Record<string, unknown>,
  recoveredOrderConflicts?: Record<string, readonly string[]>,
) {
  const composed = composePersonCockpit(snapshot, PERSON_ID);
  assert.equal(composed.ok, true);
  if (!composed.ok) return "";
  const books =
    recoveredOrderConflicts == null
      ? composed.cockpit.projectBooks
      : composePersonProjectBooks(snapshot, PERSON_ID, {
          recoveredOrderConflicts,
        });
  return renderToStaticMarkup(
    createElement(ClientProfileView, {
      cockpit: { ...composed.cockpit, projectBooks: books },
    }),
  );
}

describe("Person Project Books UI", () => {
  it("A. shows a calm empty state when the Person has zero Projects", () => {
    const html = renderBooks({
      ...emptyReadSnapshot(),
      profiles: [person()],
    });
    assert.match(html, /Project Books/);
    assert.match(html, new RegExp(PROJECT_BOOKS_EMPTY));
    assert.doesNotMatch(html, /data-project-book=/);
    assert.doesNotMatch(html, /Open Jobs|Today 5|lifecycle/i);
  });

  it("B. expands a single Project Book by default", () => {
    const html = renderBooks({
      ...emptyReadSnapshot(),
      profiles: [person()],
      relationships: [
        relationship({ fromEntityId: PERSON_ID, toEntityId: STUART_ID }),
      ],
      projectProfiles: [
        projectProfile({ projectId: STUART_ID, displayTitle: "STUART" }),
      ],
      projectHistories: [
        history(STUART_ID, { cadJobNumber: "C007157", orderNumber: "SP3066" }),
      ],
    });
    const article = bookArticle(html, STUART_ID);
    assert.match(article, /<details[^>]*open/);
    assert.match(article, /aria-expanded="true"/);
    assert.match(article, new RegExp(projectBookToggleId(STUART_ID)));
    assert.match(article, new RegExp(projectBookPanelId(STUART_ID)));
    assert.match(article, /C007157/);
    assert.match(article, /SP3066/);
    assert.match(article, /Overview/);
    assert.match(article, /Items &amp; Specs/);
    assert.match(article, /Open Project Desk/);
  });

  it("C/E. keeps multiple Project Books collapsed and independently keyed", () => {
    const html = renderBooks({
      ...emptyReadSnapshot(),
      profiles: [person()],
      relationships: [
        relationship({ fromEntityId: PERSON_ID, toEntityId: STUART_ID }),
        relationship({ fromEntityId: PERSON_ID, toEntityId: MR_STUART_ID }),
      ],
      projectProfiles: [
        projectProfile({ projectId: STUART_ID, displayTitle: "STUART" }),
        projectProfile({
          projectId: MR_STUART_ID,
          displayTitle: "MR-STUART",
        }),
      ],
      projectHistories: [history(STUART_ID), history(MR_STUART_ID)],
    });
    const stuart = bookArticle(html, STUART_ID);
    const mr = bookArticle(html, MR_STUART_ID);
    assert.doesNotMatch(stuart, /<details[^>]*open/);
    assert.doesNotMatch(mr, /<details[^>]*open/);
    assert.match(stuart, /aria-expanded="false"/);
    assert.match(mr, /aria-expanded="false"/);
    assert.doesNotMatch(stuart, / name=/);
    assert.doesNotMatch(mr, / name=/);
    assert.match(stuart, new RegExp(projectBookToggleId(STUART_ID)));
    assert.match(mr, new RegExp(projectBookToggleId(MR_STUART_ID)));
    assert.doesNotMatch(html, /Imported or other projects/);
  });

  it("D. opening STUART cannot present MR-STUART specs, history, or evidence", () => {
    const html = renderBooks({
      ...emptyReadSnapshot(),
      profiles: [person()],
      relationships: [
        relationship({ fromEntityId: PERSON_ID, toEntityId: STUART_ID }),
        relationship({ fromEntityId: PERSON_ID, toEntityId: MR_STUART_ID }),
      ],
      projectProfiles: [
        projectProfile({ projectId: STUART_ID, displayTitle: "STUART" }),
        projectProfile({
          projectId: MR_STUART_ID,
          displayTitle: "MR-STUART",
        }),
      ],
      projectHistories: [
        history(STUART_ID, {
          cadJobNumber: "C007157",
          orderNumber: "SP3066",
          fingerSize: "212",
          metal: "platinum",
          gmailThreadId: "thread-stuart-secret",
        }),
        history(MR_STUART_ID, {
          cadJobNumber: "C007040",
          orderNumber: "SP2976",
          fingerSize: "70",
          metal: "gold",
          gmailThreadId: "thread-mr-secret",
        }),
      ],
      sourceNotes: [
        note({
          personId: PERSON_ID,
          projectId: STUART_ID,
          createdAt: "2026-08-20T00:00:00.000Z",
          text: "STUART platinum notes",
        }),
        note({
          personId: PERSON_ID,
          projectId: MR_STUART_ID,
          createdAt: "2026-08-21T00:00:00.000Z",
          text: "MR-STUART gold notes",
        }),
      ],
    });
    const stuart = bookArticle(html, STUART_ID);
    const mr = bookArticle(html, MR_STUART_ID);
    assert.match(stuart, /C007157/);
    assert.match(stuart, /SP3066/);
    assert.match(stuart, /212/);
    assert.match(stuart, /platinum/);
    assert.match(stuart, /STUART platinum notes/);
    assert.doesNotMatch(stuart, /C007040/);
    assert.doesNotMatch(stuart, /SP2976/);
    assert.doesNotMatch(stuart, />70</);
    assert.doesNotMatch(stuart, /gold notes/);
    assert.doesNotMatch(stuart, /MR-STUART gold/);
    assert.match(mr, /C007040/);
    assert.match(mr, /SP2976/);
    assert.match(mr, /MR-STUART gold notes/);
    assert.doesNotMatch(mr, /C007157/);
    assert.doesNotMatch(mr, /SP3066/);
    assert.doesNotMatch(mr, /STUART platinum/);
    assert.doesNotMatch(html, /thread-stuart-secret|thread-mr-secret/);
  });

  it("F. keeps two same-title Project Books independent", () => {
    const html = renderBooks({
      ...emptyReadSnapshot(),
      profiles: [person()],
      relationships: [
        relationship({ fromEntityId: PERSON_ID, toEntityId: JESSE_A }),
        relationship({ fromEntityId: PERSON_ID, toEntityId: JESSE_B }),
      ],
      projectProfiles: [
        projectProfile({ projectId: JESSE_A, displayTitle: "Jesse R." }),
        projectProfile({ projectId: JESSE_B, displayTitle: "Jesse R." }),
      ],
      projectHistories: [
        history(JESSE_A, { cadJobNumber: "C024594" }),
        history(JESSE_B, { cadJobNumber: "C025088" }),
      ],
    });
    const a = bookArticle(html, JESSE_A);
    const b = bookArticle(html, JESSE_B);
    assert.match(a, /Jesse R\./);
    assert.match(b, /Jesse R\./);
    assert.match(a, /C024594/);
    assert.match(b, /C025088/);
    assert.match(a, /aria-label="Project Book Jesse R\., C024594"/);
    assert.match(b, /aria-label="Project Book Jesse R\., C025088"/);
    assert.doesNotMatch(a, /C025088/);
    assert.doesNotMatch(b, /C024594/);
  });

  it("G. omits unknown item type instead of inferring from the title", () => {
    const html = renderBooks({
      ...emptyReadSnapshot(),
      profiles: [person()],
      relationships: [
        relationship({ fromEntityId: PERSON_ID, toEntityId: STUART_ID }),
      ],
      projectProfiles: [
        projectProfile({
          projectId: STUART_ID,
          displayTitle: "Oval ring",
        }),
      ],
      projectHistories: [history(STUART_ID)],
    });
    const article = bookArticle(html, STUART_ID);
    assert.match(article, new RegExp(PROJECT_BOOK_EMPTY.itemsAndSpecs));
    assert.doesNotMatch(article, /item type|bracelet|repair/i);
    assert.doesNotMatch(article, /approved|in production|completed/i);
  });

  it("H. does not promote conflicting recovered orders to canonical display", () => {
    const html = renderBooks(
      {
        ...emptyReadSnapshot(),
        profiles: [person()],
        relationships: [
          relationship({ fromEntityId: PERSON_ID, toEntityId: STUART_ID }),
        ],
        projectProfiles: [
          projectProfile({ projectId: STUART_ID, displayTitle: "STUART" }),
        ],
        projectHistories: [
          history(STUART_ID, {
            orderNumber: "SP3066",
            cadJobNumber: "C007157",
          }),
        ],
      },
      { [STUART_ID]: ["SP9999"] },
    );
    const article = bookArticle(html, STUART_ID);
    assert.match(article, /SP3066/);
    assert.match(article, new RegExp(PROJECT_BOOK_FOUNDER_REVIEW));
    assert.doesNotMatch(article, /SP9999/);
  });

  it("I. does not render unlinked Projects on the Person page", () => {
    const html = renderBooks({
      ...emptyReadSnapshot(),
      profiles: [person()],
      relationships: [
        relationship({ fromEntityId: PERSON_ID, toEntityId: STUART_ID }),
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
        history(UNLINKED_ID, { cadJobNumber: "C025088" }),
      ],
    });
    assert.doesNotMatch(html, /Unlinked Book/);
    assert.doesNotMatch(html, new RegExp(UNLINKED_ID));
    assert.doesNotMatch(html, /C025088/);
    assert.match(html, /C007157/);
  });

  it("wraps long titles and keeps mutation, Gmail, and sprint leakage out", () => {
    const longTitle =
      "A very long reconstructed Project title that must wrap on a narrow founder phone without overflowing the dossier";
    const html = renderToStaticMarkup(
      createElement(PersonProjectBooksSection, {
        books: composePersonProjectBooks(
          {
            ...emptyReadSnapshot(),
            profiles: [person()],
            relationships: [
              relationship({ fromEntityId: PERSON_ID, toEntityId: STUART_ID }),
            ],
            projectProfiles: [
              projectProfile({ projectId: STUART_ID, displayTitle: longTitle }),
            ],
            projectHistories: [history(STUART_ID)],
          },
          PERSON_ID,
        ),
      }),
    );
    assert.match(html, /break-words/);
    assert.match(html, /min-w-0/);
    assert.match(html, /min-h-11/);
    assert.doesNotMatch(html, /Correct|Save|Edit|Approve|Apply/);
    assert.doesNotMatch(html, /Open Jobs|Today 5|Chief of Staff/i);
    assert.doesNotMatch(html, /gmail\.googleapis|users\/me\/messages/i);
    assert.doesNotMatch(html, /hydrate cap|query count|debug score/i);
    assert.doesNotMatch(html, /project_kind|custom vs repair/i);

    const ui = readFileSync(
      join(
        ROOT,
        "app/executive-dashboard/concierge/components/person-project-books.tsx",
      ),
      "utf8",
    );
    const compose = readFileSync(
      join(
        ROOT,
        "lib/continuum/client-memory/project-books/compose.ts",
      ),
      "utf8",
    );
    for (const source of [ui, compose]) {
      assert.doesNotMatch(source, /executeProjectArtifactHunt|getMessage\(/);
      assert.doesNotMatch(source, /runExactProjectThreadFetch|decrypt/);
      assert.doesNotMatch(source, /saveProjectLifecycle|insertSourceNote/);
      assert.doesNotMatch(source, /AchedekalReconstruction|CohortReconstruction/);
    }
  });
});
