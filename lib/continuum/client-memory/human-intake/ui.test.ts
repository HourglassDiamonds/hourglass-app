import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuickCapture } from "../../../../app/executive-dashboard/concierge/components/quick-capture";
import { InboxSourceList } from "../../../../app/executive-dashboard/concierge/components/inbox-source-list";
import { HumanSourceDetail } from "../../../../app/executive-dashboard/concierge/components/human-source-detail";
import {
  conciergeInboxNewPath,
  conciergeInboxPath,
  conciergeInboxSourcePath,
} from "../read/presentation";
import { HUMAN_SOURCE_AUTHOR_JUSTIN } from "./index";
import type { HumanSourceDetailView, InboxSourceView } from "./index";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONCIERGE_DIR = join(ROOT, "app", "executive-dashboard", "concierge");

const SAMPLE: InboxSourceView = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  sourceType: "plaud",
  ingestedAt: "2026-08-25T17:00:00.000Z",
  capturedAt: null,
  communicationType: "reported-text",
  reviewStatus: "pending",
  personNames: ["Sarah Chen"],
  projectTitles: ["Oval ring"],
  preview: "Text from Sarah today. She likes Render 2…",
  founderReported: true,
};

describe("Concierge human-source inbox UI", () => {
  it("adds Inbox next to Quick Capture and keeps founder-only routes", () => {
    const capture = renderToStaticMarkup(createElement(QuickCapture));
    assert.match(capture, new RegExp(conciergeInboxPath()));
    assert.match(capture, />Inbox</);
    const layout = readFileSync(join(CONCIERGE_DIR, "layout.tsx"), "utf8");
    assert.match(layout, /requireInternalClientMemorySession/);
    const inbox = readFileSync(join(CONCIERGE_DIR, "inbox", "page.tsx"), "utf8");
    assert.match(inbox, /title:\s*"Inbox"/);
    assert.match(inbox, /index:\s*false/);
    assert.match(inbox, /getAuthenticatedHumanSourceStore/);
    const create = readFileSync(join(CONCIERGE_DIR, "inbox", "new", "page.tsx"), "utf8");
    assert.match(create, /title:\s*"Add PLAUD source"/);
    assert.match(create, /AddPlaudForm/);
    const detail = readFileSync(
      join(CONCIERGE_DIR, "inbox", "[sourceId]", "page.tsx"),
      "utf8",
    );
    assert.match(detail, /getAuthenticatedHumanSourceStore/);
    assert.match(detail, /Memory extraction is not enabled yet|HumanSourceDetail/);
  });

  it("lists a short preview and does not dump the full transcript", () => {
    const html = renderToStaticMarkup(
      createElement(InboxSourceList, { items: [SAMPLE] }),
    );
    assert.match(html, /PLAUD/);
    assert.match(html, /Reported text/);
    assert.match(html, /Pending/);
    assert.match(html, /Sarah Chen/);
    assert.match(html, /Oval ring/);
    assert.match(html, new RegExp(conciergeInboxSourcePath(SAMPLE.id)));
    assert.doesNotMatch(html, /cathedral lower/);
    assert.doesNotMatch(html, /I told her/);
  });

  it("labels reported-text provenance on source detail without direct-channel claims", () => {
    const detail: HumanSourceDetailView = {
      source: {
        id: SAMPLE.id,
        sourceType: "plaud",
        externalSourceId: null,
        contentSha256: "a".repeat(64),
        capturedAt: null,
        ingestedAt: SAMPLE.ingestedAt,
        rawStoragePath: null,
        rawMimeType: "text/plain",
        rawByteSize: 120,
        rawText: "Text from Sarah today.\nShe likes Render 2 but wants the cathedral lower.",
        parsedText: null,
        sourceAuthor: HUMAN_SOURCE_AUTHOR_JUSTIN,
        reportedCommunicationType: "reported-text",
        parserVersion: null,
        parseStatus: "stored",
        reviewStatus: "pending",
        contextLayerProposed: "client",
        contextLayerConfirmed: "client",
        createdAt: SAMPLE.ingestedAt,
        updatedAt: SAMPLE.ingestedAt,
      },
      personNames: ["Sarah Chen"],
      projectTitles: ["Oval ring"],
      founderReported: true,
    };
    const html = renderToStaticMarkup(
      createElement(HumanSourceDetail, { detail }),
    );
    assert.match(html, /Reported by Justin/);
    assert.match(html, /did not read the original text conversation/);
    assert.match(html, /Memory extraction is not enabled yet/);
    assert.match(html, /Pending/);
    assert.match(html, /cathedral lower/);
    assert.doesNotMatch(html, /direct-channel|directly observed/i);
    assert.doesNotMatch(html, /createBrowserClient|getSupabaseAdmin/);
  });

  it("does not expose browser Supabase or public upload APIs", () => {
    const actions = readFileSync(join(CONCIERGE_DIR, "actions.ts"), "utf8");
    assert.match(actions, /savePlaudHumanSource/);
    assert.match(actions, /getAuthenticatedHumanSourceStore/);
    assert.doesNotMatch(actions, /createBrowserClient/);
    assert.doesNotMatch(actions, /from\("continuum_/);
    assert.doesNotMatch(actions, /gtag|analytics/);
    const form = readFileSync(
      join(CONCIERGE_DIR, "components", "add-plaud-form.tsx"),
      "utf8",
    );
    assert.match(form, /communicationType/);
    assert.match(form, /PLAUD_COMMUNICATION_CHOICES/);
    assert.match(form, /transcriptFile/);
    assert.doesNotMatch(form, /handwritten/);
    assert.doesNotMatch(form, /createBrowserClient/);
    const labels = readFileSync(
      join(ROOT, "lib", "continuum", "client-memory", "human-intake", "labels.ts"),
      "utf8",
    );
    assert.match(labels, /reported-text/);
    assert.match(labels, /Reported text/);
    assert.equal(conciergeInboxNewPath(), "/executive-dashboard/concierge/inbox/new");
  });
});
