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
    assert.match(html, /Client approved the design/);
    assert.doesNotMatch(html, /move forward/);
    assert.match(html, /CAD/);
    assert.match(html, /Sources currently represented/);
    assert.match(html, /Gmail/);
    assert.match(html, /Future architecture may include/);
    assert.match(html, /SMS/);
    assert.doesNotMatch(html, /gc1\||thread-secret|message-secret/);
    assert.doesNotMatch(html, /Definitely belongs/);
    assert.doesNotMatch(html, /aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/);
  });

  it("does not render production debris in founder markup", () => {
    const debris =
      "diamond_supply_notes cad_job_number finger_size 19fd370bc47c5e1f gc1|thread|msg";
    const view = presentProjectBook(
      projectBook({
        projectId: PROJECT,
        projectLabel: "J.Pennock",
        nowIso: "2026-09-23T16:00:00.000Z",
        records: [
          {
            ...record(),
            sourceRef: "debris",
            semanticClass: "founder_fulfills_commitment",
            actor: "founder",
            direction: "outbound",
            authorOwnedText: `${debris} ${debris}`,
            subject: "Re: HGD- J.Pennock-C025519",
            attachmentFilenames: ["image001.jpg"],
          },
        ],
      }),
    );
    const html = renderToStaticMarkup(createElement(ProjectBookSection, { book: view }));
    assert.doesNotMatch(html, /diamond_supply_notes|cad_job_number|finger_size/);
    assert.doesNotMatch(html, /19fd370bc47c5e1f|gc1\||image001\.jpg/);
    assert.doesNotMatch(html, /On .{0,40}wrote:/);
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
    assert.match(html, /No confirmed open obligation/);
    assert.match(html, /No source history is associated/);
    assert.match(html, /None/);
    assert.doesNotMatch(html, /Shop delivered|Client approved|Waiting on shop/);
  });
});
