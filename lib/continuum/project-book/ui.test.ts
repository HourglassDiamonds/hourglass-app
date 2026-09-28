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

  it("shows possible evidence for review and keeps it out of history", () => {
    const view = presentProjectBook(
      projectBook({
        projectId: PROJECT,
        projectLabel: "Dylon",
        records: [],
        nowIso: "2026-09-23T16:00:00.000Z",
        evidenceReview: {
          possible: [
            {
              reviewKey: "abc",
              channel: "Gmail",
              earliest: "2026-09-01T12:00:00.000Z",
              latest: "2026-09-21T18:00:00.000Z",
              subject: "RE: HGD x Dylon D.-C025610",
              attachmentNames: ["NL-H017-Dylon D-C025610-Mod4.stl"],
              reason: "A shop file on this thread contains C025610.",
              possibleMatches: [],
            },
          ],
          ambiguous: [
            {
              reviewKey: "def",
              channel: "Gmail",
              earliest: "2026-06-01T12:00:00.000Z",
              latest: "2026-06-02T12:00:00.000Z",
              subject: "RE: mixed numbers",
              attachmentNames: ["NL-H017-Jesse R. - C025088.jpg"],
              reason: "This thread contains C025088 and C026350. No project is selected automatically.",
              possibleMatches: ["Jesse R. · C025088", "Duane · C026350"],
            },
          ],
        },
      }),
    );
    const html = renderToStaticMarkup(createElement(ProjectBookSection, { book: view }));
    assert.match(html, /No history yet/);
    assert.match(html, /Possible project evidence/);
    assert.match(html, /may belong to this project/);
    assert.match(html, /Project evidence needs review/);
    assert.match(html, /Jesse R/);
    assert.match(html, /C026350/);
    assert.doesNotMatch(html, /Add to project/);
    assert.doesNotMatch(html, /19fed961d1371aaf/);
  });

  it("keeps trusted history markup free of body text and inline image noise", () => {
    const quoted =
      "The repeated quoted paragraph about the chicken ring band width stays in the mail.";
    const view = presentProjectBook(
      projectBook({
        projectId: PROJECT,
        projectLabel: "Trusted history",
        nowIso: "2026-09-23T16:00:00.000Z",
        records: [
          {
            ...record(),
            sourceRef: "pennock",
            semanticClass: "client_replies_nonblocking",
            subject: "RE: RE: HGD- J.Pennock-C025519",
            authorOwnedText:
              "On Thu, Sep 10, 2026 at 1:00 PM Shop wrote:\ndiamond_supply_notes cad_job_number finger_size 19fd370bc47c5e1f gc1|thread|msg",
            attachmentFilenames: ["image001.jpg", "NL-H017-J.Pennock-C025519-Mod2.jpg"],
            cadIds: ["C025519"],
          },
          {
            ...record(),
            sourceRef: "chicken-1",
            timestamp: "2026-08-07T15:00:00.000Z",
            semanticClass: "client_replies_nonblocking",
            subject: "RE: Chicken ring",
            authorOwnedText: `On Mon, Aug 10, 2026 at 1:00 PM Shop wrote:\n${quoted} ${quoted}`,
            attachmentFilenames: ["image001.jpg", "image002.png"],
            cadIds: [],
          },
          {
            ...record(),
            sourceRef: "chicken-file",
            timestamp: "2026-08-13T15:00:00.000Z",
            semanticClass: "vendor_order_confirmation",
            subject: "Fwd: FW: RE: HGD x Tim/Jenn-C025964-SP13477",
            authorOwnedText: quoted,
            attachmentFilenames: ["logo.png", "signature.png", "NL-H017-C025964-SP13477.pdf"],
            cadIds: ["C025964"],
          },
        ],
      }),
    );
    const html = renderToStaticMarkup(createElement(ProjectBookSection, { book: view }));
    assert.match(html, /Project file received/);
    assert.match(html, /Shop confirmed the order/);
    assert.match(html, /C025519/);
    assert.match(html, /C025964/);
    assert.match(html, /SP13477/);
    assert.match(html, /HGD x Tim\/Jenn-C025964-SP13477/);
    assert.doesNotMatch(html, /image001|image002/);
    assert.doesNotMatch(html, /diamond_supply_notes|cad_job_number|finger_size/);
    assert.doesNotMatch(html, /gc1\|/);
    assert.doesNotMatch(html, /On .{0,80}wrote:/);
    assert.doesNotMatch(html, /19fd370bc47c5e1f/);
    assert.doesNotMatch(html, /aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/);
    assert.doesNotMatch(html, /repeated quoted paragraph/);
    assert.doesNotMatch(html, /logo\.png|signature\.png/);
    assert.doesNotMatch(html, /Client reply/);
  });
});
