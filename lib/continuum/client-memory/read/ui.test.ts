import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { composePersonProfile } from "./profile";
import {
  emptyReadSnapshot,
  fact,
  note,
  personProfile,
  projectHistory,
  projectProfile,
  relationship,
  review,
  wish,
} from "./fixtures";
import { ClientProfileView } from "../../../../app/executive-dashboard/concierge/components/client-profile-view";
import { ClientSearchResultRow } from "../../../../app/executive-dashboard/concierge/components/client-search-result";
import { ConciergeUnavailable } from "../../../../app/executive-dashboard/concierge/components/client-profile-view";
import { AskConciergeAnswerView } from "../../../../app/executive-dashboard/concierge/components/ask-concierge-answer";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { QuickCapture } from "../../../../app/executive-dashboard/concierge/components/quick-capture";
import { composeContinuumHome, greetingLine } from "../../dashboard/compose";
import {
  conciergeAddNotePath,
  conciergeAddNotePickerPath,
  conciergeClientPath,
  conciergeInboxPath,
} from "./presentation";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONCIERGE_DIR = join(ROOT, "app", "executive-dashboard", "concierge");

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, found);
    else if (/\.(ts|tsx|css)$/.test(entry.name)) found.push(path);
  }
  return found;
}

describe("Concierge Client Memory UI", () => {
  it("renders empty facts and wishes without placeholders", () => {
    const person = personProfile({ displayName: "Ada Lovelace" });
    const composed = composePersonProfile(
      { ...emptyReadSnapshot(), profiles: [person] },
      person.personId,
    );
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    const html = renderToStaticMarkup(
      createElement(ClientProfileView, { profile: composed.profile }),
    );
    assert.match(html, /Ada Lovelace/);
    assert.match(html, /Add Note/);
    assert.match(html, /Add birthday/);
    assert.doesNotMatch(html, /Ring size|On their radar|Projects|Recent notes/i);
    assert.doesNotMatch(html, /No facts|coming soon|placeholder/i);
    const saved = renderToStaticMarkup(
      createElement(ClientProfileView, {
        profile: composed.profile,
        justSaved: true,
      }),
    );
    assert.match(saved, /Note saved/);
    assert.doesNotMatch(saved, /Prefers morning|ada@example/);
    const savedClient = renderToStaticMarkup(
      createElement(ClientProfileView, {
        profile: composed.profile,
        justSavedClient: true,
      }),
    );
    assert.match(savedClient, /Client added/);
    const existingClient = renderToStaticMarkup(
      createElement(ClientProfileView, {
        profile: composed.profile,
        justExistingClient: true,
      }),
    );
    assert.match(existingClient, /already in Continuum/);
  });

  it("displays a typed birthday without dumping JSON and offers Edit birthday", () => {
    const person = personProfile({ displayName: "Sarah Miller" });
    const composed = composePersonProfile(
      {
        ...emptyReadSnapshot(),
        profiles: [person],
        facts: [
          fact({
            personId: person.personId,
            factType: "birthday",
            status: "current",
            value: { calendar: "gregorian", month: 11, day: 12, year: null },
          }),
        ],
      },
      person.personId,
    );
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    const html = renderToStaticMarkup(
      createElement(ClientProfileView, { profile: composed.profile }),
    );
    assert.match(html, /Sarah Miller/);
    assert.match(html, /Birthday/);
    assert.match(html, /November 12/);
    assert.match(html, /Edit birthday/);
    assert.doesNotMatch(html, /Add birthday/);
    assert.doesNotMatch(html, /"calendar"|gregorian/);
    const saved = renderToStaticMarkup(
      createElement(ClientProfileView, {
        profile: composed.profile,
        justSavedBirthday: true,
      }),
    );
    assert.match(saved, /Birthday saved/);
  });

  it("renders projects, notes, review indicator, and omits client-project as a social row", () => {
    const person = personProfile({
      displayName: "Ada Lovelace",
      organizationName: "Analytical Engines",
      email: "ada@example.com",
      phone: "3055550100",
    });
    const project = projectProfile({ displayTitle: "Oval ring" });
    const composed = composePersonProfile(
      {
        ...emptyReadSnapshot(),
        profiles: [person],
        relationships: [
          relationship({
            fromEntityId: person.personId,
            toEntityId: project.projectId,
          }),
        ],
        projectProfiles: [project],
        projectHistories: [
          projectHistory({ projectId: project.projectId, cadJobNumber: "CAD-77" }),
        ],
        sourceNotes: [
          note({
            personId: person.personId,
            projectId: project.projectId,
            createdAt: "2026-08-22T00:00:00.000Z",
            text: "Prefers morning calls.",
          }),
        ],
        identities: [
          {
            entityId: person.personId,
            identityKind: "import_row_key",
            identifier: "continuum-reconciliation-v3:People:2",
            revokedAt: null,
          },
        ],
        reviews: [
          review({
            reasonCode: "REVIEW_MALFORMED_PHONE",
            importRowKey: "continuum-reconciliation-v3:People:2",
          }),
        ],
        facts: [
          fact({ personId: person.personId, factType: "ring-size", status: "current", value: "6.25" }),
          fact({ personId: person.personId, factType: "metal", status: "candidate" }),
        ],
        wishes: [
          wish({ personId: person.personId, description: "Quiet yellow gold", status: "active" }),
        ],
      },
      person.personId,
    );
    assert.equal(composed.ok, true);
    if (!composed.ok) return;
    const html = renderToStaticMarkup(
      createElement(ClientProfileView, { profile: composed.profile }),
    );
    assert.match(html, /Oval ring/);
    assert.match(html, /CAD-77/);
    assert.match(html, /Prefers morning calls/);
    assert.match(html, /Historical client record/);
    assert.match(html, /Client/);
    assert.match(html, /Add Note/);
    assert.match(html, /All/);
    assert.match(html, /Networking/);
    assert.match(html, /Personal/);
    assert.doesNotMatch(html, /concierge-manual/);
    assert.match(html, /Needs review/);
    assert.match(html, /6\.25/);
    assert.match(html, /Quiet yellow gold/);
    assert.match(html, /1 memory needs review/);
    assert.doesNotMatch(html, /client-project/i);
    assert.doesNotMatch(html, /import_row_key/);
    assert.doesNotMatch(html, /continuum-reconciliation-v3:People/);
    assert.doesNotMatch(html, /email_hash|phone_hash/);
    assert.doesNotMatch(html, /cost|margin|gross|vlora/i);
    assert.doesNotMatch(html, /Reconciled Projects|source_artifact|import_row/i);
  });

  it("renders a selective search result and a clean not-found state", () => {
    const resultHtml = renderToStaticMarkup(
      createElement(ClientSearchResultRow, {
        result: {
          personId: "11111111-1111-4111-8111-111111111111",
          displayName: "Ada Lovelace",
          organizationName: "Analytical Engines",
          email: "ada@example.com",
          phone: "3055550100",
          roles: ["client"],
          linkedProjectCount: 2,
        },
      }),
    );
    assert.match(resultHtml, /Ada Lovelace/);
    assert.match(resultHtml, /Analytical Engines/);
    assert.match(resultHtml, /2 projects/);
    assert.doesNotMatch(resultHtml, /ada@example.com/);

    const noteRow = renderToStaticMarkup(
      createElement(ClientSearchResultRow, {
        result: {
          personId: "11111111-1111-4111-8111-111111111111",
          displayName: "Ada Lovelace",
          organizationName: "Analytical Engines",
          email: "ada@example.com",
          phone: "3055550100",
          roles: ["client"],
          linkedProjectCount: 2,
        },
        href: conciergeAddNotePath("11111111-1111-4111-8111-111111111111"),
      }),
    );
    assert.match(
      noteRow,
      /\/executive-dashboard\/concierge\/client\/11111111-1111-4111-8111-111111111111\/note\/new/,
    );
    assert.doesNotMatch(
      noteRow,
      /\/executive-dashboard\/concierge\/client\/11111111-1111-4111-8111-111111111111"/,
    );

    const missing = renderToStaticMarkup(
      createElement(ConciergeUnavailable, {
        title: "Client record unavailable.",
        body: "This client could not be found.",
      }),
    );
    assert.match(missing, /Client record unavailable/);
    assert.doesNotMatch(missing, /Supabase|stack|uuid/i);
  });

  it("keeps the Concierge UI free of service-role, import keys, and public caching", () => {
    const files = walk(CONCIERGE_DIR);
    assert.ok(files.length > 0);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /getSupabaseAdmin/);
      assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
      assert.doesNotMatch(source, /createBrowserClient/);
      assert.doesNotMatch(source, /generateStaticParams/);
      assert.doesNotMatch(source, /import_row_key/);
      assert.doesNotMatch(source, /email_hash|phone_hash/);
      assert.doesNotMatch(source, /console\.(log|info|debug|warn)/);
    }
    const page = readFileSync(
      join(CONCIERGE_DIR, "client", "[personId]", "page.tsx"),
      "utf8",
    );
    assert.match(page, /title:\s*"Client"/);
    assert.doesNotMatch(page, /displayName/);
    const home = readFileSync(join(CONCIERGE_DIR, "page.tsx"), "utf8");
    assert.match(home, /loadContinuumHomeModel/);
    assert.match(home, /CommandCenterHome/);
    assert.match(home, /variant="home"/);
    assert.doesNotMatch(home, /Search your client memory|Search clients/);
    const search = readFileSync(
      join(CONCIERGE_DIR, "components", "concierge-search.tsx"),
      "utf8",
    );
    assert.match(search, /Search people/);
    assert.match(search, /No people found/);
    assert.match(search, /searchPeople|searchConciergeClients/);
    assert.doesNotMatch(search, /Search clients|Search your client memory/);
    assert.doesNotMatch(search, /All \| Clients|Networking filter|Personal filter/);
    assert.match(search, /autoFocus = false/);
    const command = readFileSync(
      join(CONCIERGE_DIR, "components", "command-center-home.tsx"),
      "utf8",
    );
    assert.match(command, /People/);
    assert.match(command, /<ConciergeSearch \/>/);
    assert.doesNotMatch(command, /autoFocus/);
    assert.doesNotMatch(command, /intent=/);
    const actions = readFileSync(join(CONCIERGE_DIR, "actions.ts"), "utf8");
    assert.match(actions, /getAuthenticatedClientMemoryReader/);
    assert.match(actions, /askConcierge/);
    assert.match(actions, /getAuthenticatedClientMemoryNoteWriter/);
    assert.match(actions, /getAuthenticatedClientMemoryFactWriter/);
    assert.match(actions, /getAuthenticatedClientMemoryPersonWriter/);
    assert.match(actions, /saved=1/);
    assert.match(actions, /saved=birthday/);
    assert.match(actions, /saved=client/);
    assert.match(actions, /existing=client/);
    assert.match(actions, /saved=profile/);
    assert.match(actions, /savePersonProfile/);
    assert.match(actions, /savePlaudHumanSource/);
    assert.match(actions, /getAuthenticatedHumanSourceStore/);
    assert.doesNotMatch(actions, /from\("continuum_/);
    assert.doesNotMatch(actions, /noteText=/);
    const addNote = readFileSync(
      join(CONCIERGE_DIR, "client", "[personId]", "note", "new", "page.tsx"),
      "utf8",
    );
    assert.match(addNote, /title:\s*"Add Note"/);
    assert.match(addNote, /randomUUID/);
    assert.doesNotMatch(addNote, /concierge-manual:/);
    const form = readFileSync(
      join(CONCIERGE_DIR, "components", "add-note-form.tsx"),
      "utf8",
    );
    assert.match(form, /Relationship context/);
    assert.match(form, /RELATIONSHIP_CONTEXT_LAYERS/);
    assert.match(form, /RELATIONSHIP_CONTEXT_LAYER_LABELS/);
    assert.match(form, /Save Note/);
    assert.match(form, /Cancel/);
    assert.match(form, /Related project/);
    assert.match(form, /radiogroup/);
    assert.match(form, /textarea/);
    assert.match(form, /htmlFor=\{noteId\}/);
    assert.doesNotMatch(form, /concierge-manual/);
    assert.doesNotMatch(form, /manual-note/);
    const birthdayPage = readFileSync(
      join(CONCIERGE_DIR, "client", "[personId]", "birthday", "page.tsx"),
      "utf8",
    );
    assert.match(birthdayPage, /title:\s*"Birthday"/);
    assert.match(birthdayPage, /AddBirthdayForm/);
    assert.doesNotMatch(birthdayPage, /confidence|usagePermission|visibility/);
    const birthdayForm = readFileSync(
      join(CONCIERGE_DIR, "components", "add-birthday-form.tsx"),
      "utf8",
    );
    assert.match(birthdayForm, /Save Birthday/);
    assert.match(birthdayForm, /Adding birthday for/);
    assert.match(birthdayForm, /Saving will replace the current birthday on record/);
    assert.doesNotMatch(birthdayForm, /confidence|verification|visibility|usage permission|source_system/i);
    assert.doesNotMatch(birthdayForm, /Add Fact|spouse|fiancé/i);
    const addClientPage = readFileSync(
      join(CONCIERGE_DIR, "client", "new", "page.tsx"),
      "utf8",
    );
    assert.match(addClientPage, /title:\s*"Add Client"/);
    assert.match(addClientPage, /randomUUID/);
    assert.match(addClientPage, /AddClientForm/);
    assert.doesNotMatch(addClientPage, /concierge-manual/);
    const addClientForm = readFileSync(
      join(CONCIERGE_DIR, "components", "add-client-form.tsx"),
      "utf8",
    );
    assert.match(addClientForm, /First name/);
    assert.match(addClientForm, /Last name/);
    assert.match(addClientForm, /name="email"/);
    assert.match(addClientForm, /name="phone"/);
    assert.match(addClientForm, /name="organization"/);
    assert.match(addClientForm, /Add Client/);
    assert.doesNotMatch(addClientForm, /street|address|spouse|birthday|project|noteText/i);
    assert.doesNotMatch(addClientForm, /roles|source_system|created_by/);
    const profileView = readFileSync(
      join(CONCIERGE_DIR, "components", "client-profile-view.tsx"),
      "utf8",
    );
    assert.match(profileView, /conciergeEditPersonPath/);
    assert.match(profileView, />\s*Edit\s*</);
    assert.match(profileView, /Updated\./);
    const editPage = readFileSync(
      join(CONCIERGE_DIR, "client", "[personId]", "edit", "page.tsx"),
      "utf8",
    );
    assert.match(editPage, /title:\s*"Edit"/);
    assert.match(editPage, /randomUUID/);
    assert.match(editPage, /EditPersonForm/);
    assert.doesNotMatch(editPage, /concierge-manual/);
    assert.doesNotMatch(editPage, /spouse|birthday|roles|source_system/);
    const editForm = readFileSync(
      join(CONCIERGE_DIR, "components", "edit-person-form.tsx"),
      "utf8",
    );
    assert.match(editForm, /First name/);
    assert.match(editForm, /Last name/);
    assert.match(editForm, /name="email"/);
    assert.match(editForm, /name="phone"/);
    assert.match(editForm, /name="organization"/);
    assert.match(editForm, /Save Changes/);
    assert.doesNotMatch(editForm, /street|address|spouse|birthday|project|noteText/i);
    assert.doesNotMatch(editForm, /roles|source_system|created_by/);
  });

  it("renders an honest command center without fake intelligence", () => {
    const model = composeContinuumHome({
      now: new Date("2026-08-24T18:00:00.000Z"),
    });
    const command = readFileSync(
      join(CONCIERGE_DIR, "components", "command-center-home.tsx"),
      "utf8",
    );
    const home = readFileSync(join(CONCIERGE_DIR, "page.tsx"), "utf8");
    const cos = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, { chiefOfStaff: model.chiefOfStaff }),
    );
    const capture = renderToStaticMarkup(createElement(QuickCapture));
    assert.equal(greetingLine(model), "Good afternoon, Justin.");
    assert.match(home, /loadContinuumHomeModel/);
    assert.match(home, /CommandCenterHome/);
    assert.match(command, /greetingLine/);
    assert.match(command, /ChiefOfStaffToday/);
    assert.match(command, /AskConciergeShell/);
    assert.match(command, /People/);
    assert.match(command, /QuickCapture/);
    assert.match(cos, /Chief of Staff/);
    assert.match(cos, /Today/);
    assert.match(cos, /Nothing in memory needs your attention yet/);
    assert.doesNotMatch(cos, /coming soon|warming up|learning/i);
    assert.doesNotMatch(cos, /follow-up overdue|sentiment|SLA overdue/i);
    assert.match(capture, /Quick Capture/);
    assert.match(capture, /Add Note/);
    assert.match(capture, /Add Client/);
    assert.match(capture, /\/executive-dashboard\/concierge\/note\/new/);
    assert.match(capture, /\/executive-dashboard\/concierge\/client\/new/);
    assert.doesNotMatch(command, /Search clients|Search your client memory/);
    assert.doesNotMatch(command, /autoFocus/);
  });

  it("connects Ask Concierge to a narrow authenticated Server Action", () => {
    const ask = readFileSync(
      join(CONCIERGE_DIR, "components", "ask-concierge-shell.tsx"),
      "utf8",
    );
    const answerView = readFileSync(
      join(CONCIERGE_DIR, "components", "ask-concierge-answer.tsx"),
      "utf8",
    );
    const actions = readFileSync(join(CONCIERGE_DIR, "actions.ts"), "utf8");
    assert.match(ask, /askConcierge/);
    assert.match(ask, /preventDefault/);
    assert.match(ask, /useTransition/);
    assert.match(ask, /ASK_PENDING_MESSAGE/);
    assert.match(answerView, /conciergeClientPath/);
    assert.doesNotMatch(ask, /searchConciergeClients|fetch\(|\/api\//);
    assert.doesNotMatch(ask, /localStorage|sessionStorage|gtag/);
    assert.doesNotMatch(ask, /getAuthenticatedClientMemoryReader|listCurrentBirthdaysByMonth/);
    assert.doesNotMatch(answerView, /listCurrentBirthdaysByMonth|getAuthenticatedClientMemoryReader/);
    assert.doesNotMatch(ask, /How many birthdays are coming up|Who should I follow up with|What do I know about Sarah/);
    assert.match(actions, /askConcierge/);
    assert.match(actions, /getAuthenticatedClientMemoryReader/);
    assert.match(actions, /answerAskConciergeQuery/);
    assert.doesNotMatch(actions, /console\.(log|info|debug|warn|error)/);
    assert.match(ask, /Who has a birthday in November/);
    assert.match(ask, /Birthdays next month/);
    assert.doesNotMatch(ask, /How many birthdays are coming up/);
    const one = renderToStaticMarkup(
      createElement(AskConciergeAnswerView, {
        answer: {
          kind: "birthdays-by-month",
          month: 11,
          people: [
            {
              factId: "f-sarah",
              personId: "p-sarah",
              displayName: "Sarah Miller",
              month: 11,
              day: 12,
              year: 1985,
              verification: "manual",
              sourceSystem: "concierge-manual",
            },
          ],
        },
      }),
    );
    assert.match(one, /I currently have 1 November birthday recorded/);
    assert.match(one, /Sarah Miller/);
    assert.match(one, /November 12/);
    assert.match(one, new RegExp(conciergeClientPath("p-sarah")));
    assert.doesNotMatch(one, /1985|age|years old|f-sarah|concierge-manual|confidence/);
    const unknownDay = renderToStaticMarkup(
      createElement(AskConciergeAnswerView, {
        answer: {
          kind: "birthdays-by-month",
          month: 11,
          people: [
            {
              factId: "f-mike",
              personId: "p-mike",
              displayName: "Mike Jones",
              month: 11,
              day: null,
              year: null,
              verification: "manual",
              sourceSystem: "concierge-manual",
            },
          ],
        },
      }),
    );
    assert.match(unknownDay, /November/);
    assert.doesNotMatch(unknownDay, /Unknown|November 0/);
    const zero = renderToStaticMarkup(
      createElement(AskConciergeAnswerView, {
        answer: { kind: "birthdays-by-month", month: 11, people: [] },
      }),
    );
    const error = renderToStaticMarkup(
      createElement(AskConciergeAnswerView, { answer: { kind: "error" } }),
    );
    const unsupported = renderToStaticMarkup(
      createElement(AskConciergeAnswerView, { answer: { kind: "unsupported" } }),
    );
    assert.match(zero, /No birthdays are currently recorded for November/);
    assert.match(error, /read relationship memory just now/);
    assert.match(unsupported, /from structured memory yet/);
    assert.notEqual(zero, error);
    assert.notEqual(zero, unsupported);
    assert.notEqual(error, unsupported);
  });

  it("requires a Person for Add Note and does not create an orphan write path", () => {
    const picker = readFileSync(
      join(CONCIERGE_DIR, "note", "new", "page.tsx"),
      "utf8",
    );
    const capture = renderToStaticMarkup(createElement(QuickCapture));
    assert.match(capture, new RegExp(conciergeAddNotePickerPath()));
    assert.match(capture, new RegExp(conciergeInboxPath()));
    assert.match(capture, />Inbox</);
    assert.match(picker, /intent="add-note"/);
    assert.match(picker, /title:\s*"Add Note"/);
    assert.match(picker, /Who is this about/);
    assert.match(picker, /index:\s*false/);
    assert.doesNotMatch(picker, /saveManualConciergeNote|addManualNote|noteText/);
    assert.doesNotMatch(picker, /displayName|Justin@/);
    const search = readFileSync(
      join(CONCIERGE_DIR, "components", "concierge-search.tsx"),
      "utf8",
    );
    assert.match(search, /conciergeAddNotePath/);
    assert.match(search, /conciergeClientPath/);
    assert.doesNotMatch(search, /suggestRelationshipContextLayer/);
    assert.doesNotMatch(search, /contextLayer/);
  });

  it("does not treat note context as a Person role on the home or picker", () => {
    const home = readFileSync(
      join(CONCIERGE_DIR, "components", "command-center-home.tsx"),
      "utf8",
    );
    const picker = readFileSync(
      join(CONCIERGE_DIR, "note", "new", "page.tsx"),
      "utf8",
    );
    const search = readFileSync(
      join(CONCIERGE_DIR, "components", "concierge-search.tsx"),
      "utf8",
    );
    for (const source of [home, picker, search]) {
      assert.doesNotMatch(source, /RELATIONSHIP_CONTEXT_LAYERS/);
      assert.doesNotMatch(source, /Clients \| Networking \| Personal/);
      assert.doesNotMatch(source, /filter.*contextLayer|contextLayer ===/);
    }
    const profile = readFileSync(
      join(CONCIERGE_DIR, "client", "[personId]", "page.tsx"),
      "utf8",
    );
    assert.match(profile, /getPersonProfile/);
    assert.match(profile, /ClientProfileView/);
  });

  it("leaves founder auth and passkeys outside the command center", () => {
    const dashboardDir = join(ROOT, "lib", "continuum", "dashboard");
    for (const file of walk(dashboardDir)) {
      if (file.endsWith(".test.ts")) continue;
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /passkeys|WebAuthn|issue-session|password\.ts/);
      assert.doesNotMatch(source, /lib\/agent-os/);
    }
    const layout = readFileSync(join(CONCIERGE_DIR, "layout.tsx"), "utf8");
    assert.match(layout, /requireInternalClientMemorySession/);
    const picker = readFileSync(
      join(CONCIERGE_DIR, "note", "new", "page.tsx"),
      "utf8",
    );
    assert.match(picker, /CONCIERGE_HOME_PATH/);
  });
});
