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
    assert.match(home, /Search your client memory|ConciergeSearch/);
    const search = readFileSync(
      join(CONCIERGE_DIR, "components", "concierge-search.tsx"),
      "utf8",
    );
    assert.match(search, /Search your client memory/);
    const actions = readFileSync(join(CONCIERGE_DIR, "actions.ts"), "utf8");
    assert.match(actions, /getAuthenticatedClientMemoryReader/);
    assert.match(actions, /getAuthenticatedClientMemoryNoteWriter/);
    assert.match(actions, /saved=1/);
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
  });
});
