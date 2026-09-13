import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { currentProjectFocusHref } from "@/lib/continuum/client-memory/open-projects/present";
import { parseGmailFromHeader } from "@/lib/continuum/gmail/payload";
import { composeTodayDocket } from "./docket";
import { selectOpenEmailSources } from "./email-source";
import {
  composeEmailCard,
  composeSourceViewerRequest,
  founderSafeText,
  mergeEmailCardPreview,
  presentIndexedSourceViewer,
  presentEvidenceOnlySourceViewer,
  presentSourceViewer,
  presentUnassignedHeadline,
  sourceRefFromHref,
  sourceViewerPreviewFromView,
  usefulSenderEmail,
  usefulSenderName,
  VIEW_EMAIL_LABEL,
  OPEN_IN_GMAIL_LABEL,
  CONFLICT_SOURCE_UNAVAILABLE_COPY,
  type SourceViewerMessageInput,
} from "./email-viewer";
import { presentFounderEvidence, selectFounderControls } from "./founder-actions";
import { COS_LOOP_PROJECT_A } from "./fixtures";
import {
  COS_OPERATING_LOOP_CONTRACT_VERSION,
  type CosBriefItem,
  type CosEvidenceBeat,
  type CosOperatingLoopView,
} from "./types";
import { COS_CAUGHT_UP_HEADING } from "./present";

const CLIENT_THREAD = "abc123def0";
const CLIENT_MSG = "aaa111bbb2";
const CLIENT_HREF = `https://mail.google.com/mail/u/0/#all/${CLIENT_THREAD}/${CLIENT_MSG}`;
const OTHER_THREAD = "111222333a";
const OTHER_HREF = `https://mail.google.com/mail/u/0/#all/${OTHER_THREAD}/ddd333eee4`;
const BRIEF_HREF = "https://mail.google.com/mail/u/0/#all/fed098cba1/ccc222ddd3";
const UNIQUE_BODY =
  "Please confirm the platinum band and send the CAD recap this afternoon.";

function beat(extra: Partial<CosEvidenceBeat> & Pick<CosEvidenceBeat, "candidateId">): CosEvidenceBeat {
  return {
    at: "Sep 8",
    label: "Sep 8 · Travis Morse → Justin",
    summary: "Size is 11",
    speaker: "client",
    sourceHref: CLIENT_HREF,
    ...extra,
  };
}

function brief(extra: Partial<CosBriefItem> = {}): CosBriefItem {
  return {
    id: "brief-travis",
    rank: 1,
    rankClass: "deadline_risk",
    personLabel: "Travis Morse",
    projectTitle: "Chicken ring",
    projectId: COS_LOOP_PROJECT_A,
    headline: "Confirm the finger size before this moves forward.",
    explanation: "The project says 12.5, but the latest evidence says 11.",
    recommended: "Confirm the current finger size.",
    stateLabel: null,
    urgencyLabel: null,
    actions: [
      {
        kind: "open_project",
        label: "Open project",
        href: currentProjectFocusHref(COS_LOOP_PROJECT_A),
      },
      {
        kind: "open_email",
        label: "Open email",
        href: CLIENT_HREF,
      },
    ],
    evidence: [beat({ candidateId: "cand-1" })],
    openJobLabel: null,
    projectStateLabel: null,
    candidateIds: ["cand-1"],
    proposedAction: null,
    specConflict: {
      fieldName: "finger_size",
      fieldLabel: "Finger size",
      canonicalValue: "12.5",
      proposedValue: "11",
      candidateId: "cand-1",
      canMutate: true,
      sourceHref: CLIENT_HREF,
      sourceGenerated: false,
    },
    ...extra,
  };
}

function loop(extra: Partial<CosOperatingLoopView> = {}): CosOperatingLoopView {
  return {
    contractVersion: COS_OPERATING_LOOP_CONTRACT_VERSION,
    status: "active",
    heading: COS_CAUGHT_UP_HEADING,
    quietDetail: null,
    top5: [],
    remainingCount: 0,
    brief: [],
    watching: [],
    needsYourDecision: [],
    worthKnowing: [],
    recap: [],
    anomalies: [],
    proposedActions: [],
    ...extra,
  };
}

function message(extra: Partial<SourceViewerMessageInput> & Pick<SourceViewerMessageInput, "messageId">): SourceViewerMessageInput {
  return {
    fromRaw: "Travis Morse <travis@client.test>",
    fromEmail: "travis@client.test",
    to: ["justin@hourglass.test"],
    cc: [],
    subject: "Finger size",
    sentAt: "2026-09-08T15:00:00.000Z",
    plainText: UNIQUE_BODY,
    snippet: "Please confirm the platinum band",
    attachments: [{ filename: "cad-v3.pdf", mimeType: "application/pdf" }],
    ...extra,
  };
}

describe("in-app email viewer presentation", () => {
  it("parses sender display name and email without exposing hashes", () => {
    assert.deepEqual(parseGmailFromHeader(`"Nate Pearl" <nate.pearl@example.test>`), {
      email: "nate.pearl@example.test",
      displayName: "Nate Pearl",
    });
    assert.equal(usefulSenderName("the client"), null);
    assert.equal(usefulSenderName("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), null);
    assert.equal(usefulSenderEmail("not-an-email"), null);
    assert.equal(founderSafeText("gc1|abc123def0|aaa111bbb2"), null);
  });

  it("opens the known client source and keeps Gmail as a secondary href", () => {
    const item = composeTodayDocket(loop({ brief: [brief()] })).items[0]!;
    const controls = selectFounderControls(item);
    const request = composeSourceViewerRequest(item, controls.emailSources, presentFounderEvidence(item));
    assert.equal(controls.emailSources[0]?.href, CLIENT_HREF);
    assert.ok(request);
    const view = presentSourceViewer({
      href: CLIENT_HREF,
      threadId: CLIENT_THREAD,
      messages: [message({ messageId: CLIENT_MSG })],
      request: request!,
      internalEmails: ["justin@hourglass.test"],
    });
    assert.ok(view);
    assert.equal(view?.gmailHref, CLIENT_HREF);
    assert.equal(view?.sourceRef, `gc1|${CLIENT_THREAD}|${CLIENT_MSG}`);
    assert.equal(view?.personLabel, "Travis Morse");
    assert.equal(view?.projectTitle, "Chicken ring");
    assert.equal(view?.focused.fromDisplayName, "Travis Morse");
    assert.equal(view?.focused.fromEmail, "travis@client.test");
    assert.equal(view?.focused.body, UNIQUE_BODY);
    assert.equal(view?.focused.to.length, 0);
    assert.equal(view?.focused.attachments[0]?.filename, "cad-v3.pdf");
    assert.equal(view?.readOnly, true);
    assert.match(view?.why ?? "", /Why Continuum flagged this/);
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { loop: loop({ brief: [brief()] }) }));
    assert.match(html, new RegExp(VIEW_EMAIL_LABEL));
    assert.match(html, /data-cos-gmail-href="https:\/\/mail\.google\.com\/mail\/u\/0\/#all\/abc123def0\/aaa111bbb2"/);
    assert.doesNotMatch(html, new RegExp(UNIQUE_BODY));
    assert.doesNotMatch(html, />Open email</);
    assert.doesNotMatch(html, /Reply|Archive|Mark unread|>Send</);
  });

  it("surfaces unknown-sender identity on Unassigned without a Person label", () => {
    const item = composeTodayDocket(loop({
      brief: [brief({
        personLabel: null,
        projectTitle: null,
        projectId: null,
        specConflict: null,
        rankClass: "client_reply",
        recommended: "Do it, or add it to Top 5.",
        explanation: "it is not already on Top 5.",
        evidence: [beat({
          candidateId: "cand-unknown",
          label: "Sep 8 · the client → Justin",
          summary: UNIQUE_BODY,
        })],
      })],
    })).items[0]!;
    assert.equal(item.subject, "Unassigned");
    assert.notEqual(item.headline, "Do this now.");
    const controls = selectFounderControls(item);
    const card = composeEmailCard(item, controls.emailSources);
    assert.equal(card?.excerpt, UNIQUE_BODY);
    assert.equal(card?.hydrateHref, CLIENT_HREF);
    assert.equal(card?.senderEmail, null);
    const merged = mergeEmailCardPreview(card!, {
      senderDisplayName: null,
      senderEmail: "jordan.reed@example.test",
      subject: "Another piece",
    });
    assert.equal(merged.senderEmail, "jordan.reed@example.test");
    assert.equal(merged.subject, "Another piece");
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, {
      loop: loop({
        brief: [brief({
          personLabel: null,
          projectTitle: null,
          projectId: null,
          specConflict: null,
          rankClass: "client_reply",
          recommended: "Do it, or add it to Top 5.",
          explanation: "it is not already on Top 5.",
          evidence: [beat({
            candidateId: "cand-unknown",
            summary: UNIQUE_BODY,
          })],
        })],
      }),
    }));
    assert.match(html, /Unassigned/);
    assert.match(html, /data-cos-unassigned-card/);
    assert.match(html, /data-cos-email-excerpt/);
    assert.match(html, /Confirm person/);
    assert.doesNotMatch(html, /aaaaaaaaaaaaaaaa/);
    assert.doesNotMatch(html, /cand-unknown/);
  });

  it("keeps spec-conflict provenance on the conflict source message", () => {
    const conflictHref = `https://mail.google.com/mail/u/0/#all/${OTHER_THREAD}/eee444fff5`;
    const itemBrief = brief({
      specConflict: {
        fieldName: "finger_size",
        fieldLabel: "Finger size",
        canonicalValue: "12.5",
        proposedValue: "11",
        candidateId: "cand-conflict",
        canMutate: true,
        sourceHref: conflictHref,
        sourceGenerated: false,
      },
      evidence: [
        beat({ candidateId: "cand-other", sourceHref: CLIENT_HREF }),
        beat({
          candidateId: "cand-conflict",
          sourceHref: conflictHref,
          summary: "Size is actually 11",
        }),
      ],
    });
    const sources = selectOpenEmailSources({
      beats: itemBrief.evidence,
      specCandidateId: "cand-conflict",
      conflictMode: true,
      conflictSourceHref: conflictHref,
      canonicalThreadId: CLIENT_THREAD,
      fallbackHref: CLIENT_HREF,
    });
    assert.deepEqual(sources.map((row) => row.href), [conflictHref]);
    const item = composeTodayDocket(loop({ brief: [itemBrief] })).items[0]!;
    const controls = selectFounderControls(item);
    assert.equal(controls.openEmail?.href, conflictHref);
    const request = composeSourceViewerRequest(item, controls.emailSources, presentFounderEvidence(item));
    const view = presentSourceViewer({
      href: conflictHref,
      threadId: OTHER_THREAD,
      messages: [message({
        messageId: "eee444fff5",
        subject: "Size change",
        plainText: "Size is actually 11",
      })],
      request: request!,
    });
    assert.equal(view?.gmailHref, conflictHref);
    assert.equal(view?.focused.subject, "Size change");
    assert.match(view?.facts[0]?.value ?? "", /12\.5/);
  });

  it("does not substitute generated operating mail when multiple real threads exist", () => {
    const itemBrief = brief({
      specConflict: null,
      canonicalGmailThreadId: "fed098cba1",
      evidence: [
        beat({ candidateId: "cand-1" }),
        beat({
          candidateId: "cand-other",
          sourceHref: OTHER_HREF,
          summary: "Different thread",
        }),
        beat({
          candidateId: "cand-brief",
          sourceHref: BRIEF_HREF,
          generatedSource: true,
          summary: "Hourglass Morning Brief restates the work",
        }),
      ],
    });
    const item = composeTodayDocket(loop({ brief: [itemBrief] })).items[0]!;
    const controls = selectFounderControls(item);
    assert.equal(controls.emailSources.some((row) => row.href === BRIEF_HREF), false);
    assert.equal(controls.emailSources.some((row) => row.href === CLIENT_HREF), true);
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { loop: loop({ brief: [itemBrief] }) }));
    assert.match(html, /data-cos-gmail-href="https:\/\/mail\.google\.com\/mail\/u\/0\/#all\//);
    assert.doesNotMatch(html, /fed098cba1/);
  });

  it("hides the viewer for generated-only evidence", () => {
    const itemBrief = brief({
      specConflict: {
        fieldName: "finger_size",
        fieldLabel: "Finger size",
        canonicalValue: "12.5",
        proposedValue: "11",
        candidateId: "cand-brief",
        canMutate: true,
        sourceHref: null,
        sourceGenerated: true,
      },
      actions: [{ kind: "open_email", label: "Open email", href: BRIEF_HREF }],
      evidence: [beat({
        candidateId: "cand-brief",
        sourceHref: BRIEF_HREF,
        generatedSource: true,
        summary: "Generated operating brief",
      })],
    });
    const item = composeTodayDocket(loop({ brief: [itemBrief] })).items[0]!;
    const controls = selectFounderControls(item);
    assert.equal(composeSourceViewerRequest(item, controls.emailSources, presentFounderEvidence(item)), null);
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { loop: loop({ brief: [itemBrief] }) }));
    assert.doesNotMatch(html, /View email/);
    assert.doesNotMatch(html, /data-cos-view-email/);
  });

  it("falls back to the Gmail snippet when body text is missing", () => {
    const item = composeTodayDocket(loop({ brief: [brief()] })).items[0]!;
    const request = composeSourceViewerRequest(
      item,
      selectFounderControls(item).emailSources,
      presentFounderEvidence(item),
    );
    const view = presentSourceViewer({
      href: CLIENT_HREF,
      threadId: CLIENT_THREAD,
      messages: [message({
        messageId: CLIENT_MSG,
        plainText: null,
        snippet: "Please confirm the platinum band",
      })],
      request: request!,
    });
    assert.equal(view?.focused.body, "Please confirm the platinum band");
    assert.equal(view?.focused.snippetFallback, true);
    const preview = sourceViewerPreviewFromView(view!);
    assert.equal(preview.senderEmail, "travis@client.test");
    assert.doesNotMatch(preview.excerpt ?? "", /UNIQUE/);
  });

  it("keeps Open in Gmail as a secondary label and rewrites generic unassigned headlines", () => {
    assert.equal(OPEN_IN_GMAIL_LABEL, "Open in Gmail");
    assert.equal(
      presentUnassignedHeadline("Do this now.", [UNIQUE_BODY]),
      "Please confirm the platinum band and send the CAD recap this afternoon.",
    );
    assert.equal(presentUnassignedHeadline("Do this now.", []), "Identify who this is from.");
    assert.equal(sourceRefFromHref(CLIENT_HREF), `gc1|${CLIENT_THREAD}|${CLIENT_MSG}`);
  });

  it("keeps association and evidence when live Gmail body is unavailable", () => {
    const item = composeTodayDocket(loop({ brief: [brief()] })).items[0]!;
    const request = composeSourceViewerRequest(
      item,
      selectFounderControls(item).emailSources,
      presentFounderEvidence(item),
    );
    const trailingEmpty = {
      ...request!,
      beats: [
        ...request!.beats,
        {
          ...request!.beats[0]!,
          candidateId: "cand-empty",
          summary: "",
        },
      ],
    };
    const view = presentIndexedSourceViewer({
      href: CLIENT_HREF,
      indexedSubject: "Finger size",
      request: trailingEmpty,
    });
    assert.equal(view?.gmailHref, CLIENT_HREF);
    assert.equal(view?.personLabel, "Travis Morse");
    assert.equal(view?.focused.subject, "Finger size");
    assert.equal(view?.focused.snippetFallback, true);
    assert.equal(view?.focused.body, "Size is 11");
    assert.equal(view?.readOnly, true);
  });

  it("does not let sibling Person/Project Gmail displace the conflict source", () => {
    const conflictHref = `https://mail.google.com/mail/u/0/#all/${OTHER_THREAD}/eee444fff5`;
    const vendorHref = CLIENT_HREF;
    const itemBrief = brief({
      canonicalGmailThreadId: CLIENT_THREAD,
      specConflict: {
        fieldName: "finger_size",
        fieldLabel: "Finger size",
        canonicalValue: "12.5",
        proposedValue: "11",
        candidateId: "cand-conflict",
        canMutate: true,
        sourceHref: conflictHref,
        sourceGenerated: false,
      },
      evidence: [
        beat({ candidateId: "cand-vendor", sourceHref: vendorHref, speaker: "vendor" }),
        beat({
          candidateId: "cand-conflict",
          sourceHref: conflictHref,
          summary: "Size is actually 11",
        }),
      ],
    });
    const item = composeTodayDocket(loop({ brief: [itemBrief] })).items[0]!;
    const controls = selectFounderControls(item);
    assert.equal(controls.openEmail?.href, conflictHref);
    assert.equal(controls.emailSources.some((row) => row.href === vendorHref), false);
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { loop: loop({ brief: [itemBrief] }) }));
    assert.match(html, new RegExp(VIEW_EMAIL_LABEL));
    assert.match(html, /111222333a\/eee444fff5/);
    assert.doesNotMatch(html, /data-cos-gmail-href="https:\/\/mail\.google\.com\/mail\/u\/0\/#all\/abc123def0\/aaa111bbb2"/);
  });

  it("falls back to indexed evidence when the exact conflict Gmail source is unavailable", () => {
    const vendorHref = CLIENT_HREF;
    const itemBrief = brief({
      canonicalGmailThreadId: CLIENT_THREAD,
      specConflict: {
        fieldName: "finger_size",
        fieldLabel: "Finger size",
        canonicalValue: "12.5",
        proposedValue: "11",
        candidateId: "cand-conflict",
        canMutate: true,
        sourceHref: null,
        sourceGenerated: false,
      },
      evidence: [
        beat({ candidateId: "cand-vendor", sourceHref: vendorHref, speaker: "vendor" }),
        beat({
          candidateId: "cand-conflict",
          sourceHref: null,
          summary: "finger size 11",
        }),
      ],
    });
    const item = composeTodayDocket(loop({ brief: [itemBrief] })).items[0]!;
    const controls = selectFounderControls(item);
    assert.equal(controls.emailSources.length, 0);
    assert.equal(controls.openEmail, null);
    const request = composeSourceViewerRequest(item, controls.emailSources, presentFounderEvidence(item));
    assert.ok(request);
    assert.equal(request?.provenanceLimited, true);
    assert.equal(request?.sources.length, 0);
    assert.match(request?.why ?? "", new RegExp(CONFLICT_SOURCE_UNAVAILABLE_COPY));
    const view = presentEvidenceOnlySourceViewer(request!);
    assert.equal(view.gmailHref, "");
    assert.equal(view.sourceRef, null);
    assert.equal(view.focused.subject, "Indexed evidence");
    assert.match(view.why ?? "", /original Gmail message/);
    assert.match(view.facts[0]?.value ?? "", /12\.5/);
    const html = renderToStaticMarkup(createElement(ChiefOfStaffToday, { loop: loop({ brief: [itemBrief] }) }));
    assert.match(html, new RegExp(VIEW_EMAIL_LABEL));
    assert.match(html, /data-cos-source-limited/);
    assert.doesNotMatch(html, /data-cos-gmail-href="https:\/\/mail\.google\.com\/mail\/u\/0\/#all\/abc123def0/);
  });
});
