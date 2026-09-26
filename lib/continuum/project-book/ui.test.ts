import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { ProjectBookSection } from "../../../app/executive-dashboard/concierge/components/project-book-section";
import { projectBook } from "./project";
import { presentProjectBook } from "./present";
import type { ProjectBookSourceRecord } from "./types";

const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function record(): ProjectBookSourceRecord {
  return {
    sourceType: "gmail",
    sourceRef: "gc1|thread-secret|message-secret",
    timestamp: "2026-09-18T15:00:00.000Z",
    actor: "client",
    direction: "inbound",
    semanticClass: "client_approves",
    subject: "Re: CAD revision",
    authorOwnedText: "I love the latest direction and want to move forward.",
    attachmentFilenames: ["NL-H017-Nate-C026176.pdf"],
    personLabel: "Nathan",
    projectId: PROJECT,
    association: "exact",
    plausibleProjectIds: [PROJECT],
    cadIds: ["C026176"],
    provenance: "indexed_gmail",
  };
}

describe("Project Book UI", () => {
  it("leads with the conclusion and hides raw source refs", () => {
    const view = presentProjectBook(
      projectBook({
        projectId: PROJECT,
        projectLabel: "Dagger ring",
        records: [record()],
        nowIso: "2026-09-23T16:00:00.000Z",
      }),
    );
    const html = renderToStaticMarkup(createElement(ProjectBookSection, { book: view }));
    assert.match(html, /Project Book/);
    assert.match(html, /Current state/);
    assert.match(html, /Client approved/);
    assert.match(html, /move forward/);
    assert.match(html, /CAD/);
    assert.match(html, /Sources currently represented/);
    assert.match(html, /Gmail/);
    assert.match(html, /Future architecture may include/);
    assert.match(html, /SMS/);
    assert.doesNotMatch(html, /gc1\||thread-secret|message-secret/);
    assert.doesNotMatch(html, /Definitely belongs/);
  });

  it("renders an empty project without inventing history", () => {
    const view = presentProjectBook(
      projectBook({
        projectId: PROJECT,
        projectLabel: "Empty",
        records: [],
        nowIso: "2026-09-23T16:00:00.000Z",
      }),
    );
    const html = renderToStaticMarkup(createElement(ProjectBookSection, { book: view }));
    assert.match(html, /No history yet/);
    assert.match(html, /No source history is associated/);
    assert.match(html, /None/);
    assert.doesNotMatch(html, /Shop delivered|Client approved|Waiting on shop/);
  });
});
