import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  classifyTodayCommunication,
  pickTodayVendorContext,
  vendorOrganizationFromGmailContext,
  vendorOrganizationFromIdentityText,
} from "@/lib/continuum/candidates/founder-attention";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import {
  composeEmailCard,
  pickExternalSenderPreview,
  presentSourceViewer,
  sourceViewerPreviewFromView,
  type SourceViewerMessageInput,
} from "./email-viewer";
import { selectFounderControls } from "./founder-actions";
import { COS_LOOP_NOW, fixtureCandidate } from "./fixtures";
import type { CosProjectContext } from "./types";

const BEE_THREAD = "1a05e121b978fcdb";
const BEE_MSG = "1a08bb15b09914f3";
const BEE_HREF = `https://mail.google.com/mail/u/0/#all/${BEE_THREAD}/${BEE_MSG}`;
const VLORA_THREAD = "1a0a0e97f4da2223";
const LEE_THREAD = "1a0a777131b641f1";
const LEE_OUTBOUND = "1a0ac6ad45444062";
const LEE_INBOUND = "1a0ac812e84639d5";
const LEE_HREF = `https://mail.google.com/mail/u/0/#all/${LEE_THREAD}/${LEE_OUTBOUND}`;
const FOUNDER_EMAIL = "justin@hourglassdiamonds.com";

function livePersonAssociation(
  candidateId: string,
  threadId: string,
  messageId: string,
): ContinuumCandidate {
  return fixtureCandidate({
    candidateId,
    sourceRef: `gc1|${threadId}|${messageId}`,
    candidateType: "person_association",
    confidence: "low",
    proposedTarget: { kind: "person", personId: null },
    payload: {
      kind: "person_association",
      displayName: null,
      emailHash: "unresolved-hash",
      mintPerson: false,
      mergePersons: false,
    },
    evidenceBasis: {
      ruleIds: ["unresolved_email_hash"],
      matchedText: null,
    },
  });
}

function liveOpenJob(
  candidateId: string,
  threadId: string,
  messageId: string,
  extra: {
    subject: string;
    matchedText: string;
    ruleIds: readonly string[];
    jobKind?: "commitment" | "request";
  },
): ContinuumCandidate {
  return fixtureCandidate({
    candidateId,
    sourceRef: `gc1|${threadId}|${messageId}`,
    sourceTimestamp: "2026-09-06T15:00:00.000Z",
    candidateType: "open_job",
    proposedTarget: { kind: "open_job", projectId: null },
    payload: {
      kind: "open_job",
      jobKind: extra.jobKind ?? "commitment",
      subject: extra.subject,
      detail: null,
      waitingOnActor: extra.jobKind === "request" ? "founder" : "founder",
      dueAt: null,
      createJob: false,
    },
    evidenceBasis: {
      ruleIds: [...extra.ruleIds],
      matchedText: extra.matchedText,
    },
  });
}

function todayOf(
  candidates: ContinuumCandidate[],
  options?: {
    threadContext?: Map<string, { subject?: string | null; fromDisplayName?: string | null; fromEmail?: string | null }>;
    vendorDirectory?: readonly string[];
    evidenceTexts?: readonly string[];
    projects?: Map<string, CosProjectContext>;
  },
) {
  return composeTodayDocket(
    composeCosOperatingLoop({
      jobs: [],
      candidates,
      projects: options?.projects ?? new Map(),
      nowIso: COS_LOOP_NOW,
      threadContext: options?.threadContext,
      vendorDirectory: options?.vendorDirectory,
      evidenceTexts: options?.evidenceTexts,
    }),
  );
}

function viewerMessage(
  extra: Partial<SourceViewerMessageInput> & Pick<SourceViewerMessageInput, "messageId">,
): SourceViewerMessageInput {
  return {
    fromRaw: "Justin Smith <justin@hourglassdiamonds.com>",
    fromEmail: FOUNDER_EMAIL,
    to: ["shop@example.test"],
    cc: [],
    subject: "Re: HGD x Bee Engraving",
    sentAt: "2026-09-06T15:00:00.000Z",
    plainText: "I'll email over a label today so you're not waiting on me.",
    snippet: "I'll email over a label today",
    attachments: [],
    ...extra,
  };
}

describe("Today live-shape Gmail identity", () => {
  it("Bee live harvest + indexed subject is vendor context, not Unassigned or Confirm Person", () => {
    const assoc = livePersonAssociation("bee-assoc", BEE_THREAD, BEE_MSG);
    const job = liveOpenJob("bee-job", BEE_THREAD, BEE_MSG, {
      subject: "I'll email over a label today",
      matchedText: "I'll email over a label today so you're not waiting on me if youd prefer",
      ruleIds: ["explicit_founder_commitment"],
    });
    const threadContext = new Map([
      [BEE_THREAD, { subject: "Re: HGD x Bee Engraving" }],
    ]);
    assert.equal(assoc.payload.kind === "person_association" ? assoc.payload.displayName : "x", null);
    assert.equal(vendorOrganizationFromIdentityText("Re: HGD x Bee Engraving"), "Bee Engraving");
    assert.equal(
      classifyTodayCommunication({
        candidates: [assoc, job],
        thread: { subject: "Re: HGD x Bee Engraving" },
      }),
      "vendor",
    );
    assert.equal(
      pickTodayVendorContext({
        candidates: [assoc, job],
        thread: { subject: "Re: HGD x Bee Engraving" },
      }),
      "Bee Engraving",
    );
    const docket = todayOf([assoc, job], { threadContext });
    const card = docket.items[0];
    assert.ok(card);
    assert.equal(card?.subject, "Bee Engraving");
    assert.notEqual(card?.subject, "Unassigned");
    assert.equal(card?.brief?.personLabel ?? null, null);
    assert.equal(card?.brief?.organizationLabel, "Bee Engraving");
    assert.equal(card?.brief?.projectId ?? null, null);
    assert.equal(
      card?.brief?.actions.some((action) => action.kind === "confirm_person") ?? false,
      false,
    );
    assert.equal(selectFounderControls(card!).confirmPerson, null);
    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, {
        loop: composeCosOperatingLoop({
          jobs: [],
          candidates: [assoc, job],
          nowIso: COS_LOOP_NOW,
          threadContext,
        }),
      }),
    );
    assert.doesNotMatch(html, /Confirm person/);
    assert.doesNotMatch(html, />Unassigned</);
    assert.match(html, /Bee Engraving/);
    assert.match(html, /Dismiss from Today/);
    const emailCard = composeEmailCard(card!, selectFounderControls(card!).emailSources);
    assert.equal(emailCard, null);
  });

  it("Niurka live harvest uses known vendor domain evidence without minting a Person", () => {
    const assoc = livePersonAssociation("niurka-assoc", VLORA_THREAD, "1a0a1f153add83b4");
    const job = liveOpenJob("niurka-job", VLORA_THREAD, "1a0a1f153add83b4", {
      subject: "Can you send me the stl file for this one as well",
      matchedText: "Can you send me the stl file for this one as well",
      ruleIds: ["explicit_client_request"],
      jobKind: "request",
    });
    const thread = {
      subject: "RE: HGD - Question (3 stone)",
      fromDisplayName: "Niurka Lulo",
      fromEmail: "niurka@vlora.com",
    };
    assert.equal(
      vendorOrganizationFromGmailContext({
        thread,
        vendorDirectory: ["Vlora"],
      }),
      "Vlora",
    );
    assert.equal(
      vendorOrganizationFromGmailContext({
        thread,
      }),
      null,
    );
    assert.equal(
      classifyTodayCommunication({
        candidates: [assoc, job],
        thread,
        vendorDirectory: ["Vlora"],
      }),
      "vendor",
    );
    const docket = todayOf([assoc, job], {
      threadContext: new Map([[VLORA_THREAD, thread]]),
      vendorDirectory: ["Vlora"],
    });
    const card = docket.items[0];
    assert.ok(card);
    assert.equal(card?.subject, "Vlora");
    assert.notEqual(card?.subject, "Unassigned");
    assert.equal(card?.brief?.personLabel ?? null, null);
    assert.equal(card?.brief?.organizationLabel, "Vlora");
    assert.equal(card?.brief?.projectId ?? null, null);
    assert.equal(
      card?.brief?.actions.some((action) => action.kind === "confirm_person") ?? false,
      false,
    );
    assert.equal(selectFounderControls(card!).confirmPerson, null);

    const supplyNotes = todayOf([assoc, job], {
      threadContext: new Map([[VLORA_THREAD, thread]]),
      projects: new Map([
        [
          "unrelated-mounting",
          {
            projectId: "unrelated-mounting",
            title: "Unrelated mounting",
            personName: "Client Hale",
            people: [],
            isCurrent: true,
            specs: [
              {
                fieldName: "diamond_supply_notes",
                value: "Vlora lab-grown on mounting",
              },
            ],
            gmailThreadId: "other-thread-not-this-one",
          },
        ],
      ]),
    });
    assert.equal(supplyNotes.items[0]?.subject, "Vlora");
    assert.equal(supplyNotes.items[0]?.brief?.projectId ?? null, null);
    assert.equal(selectFounderControls(supplyNotes.items[0]!).confirmPerson, null);
  });

  it("Lee live harvest does not project-link by subject token and does not show Justin", () => {
    const assoc = livePersonAssociation("lee-assoc", LEE_THREAD, LEE_INBOUND);
    const job = liveOpenJob("lee-job", LEE_THREAD, LEE_OUTBOUND, {
      subject: "circle back on the CAD",
      matchedText: "circle back on the CAD",
      ruleIds: ["explicit_follow_up"],
    });
    const threadContext = new Map([
      [
        LEE_THREAD,
        {
          subject: "Re: Cornflower Blue - Yogo Sapphire - Lee",
          fromDisplayName: "Justin Smith",
          fromEmail: FOUNDER_EMAIL,
        },
      ],
    ]);
    const timLeeProject = new Map<string, CosProjectContext>([
      [
        "da1cb824-7e73-4b67-9ca0-68ab15839ecd",
        {
          projectId: "da1cb824-7e73-4b67-9ca0-68ab15839ecd",
          title: "Lee / Spiegel",
          personName: "Tim Lee",
          people: [
            {
              personId: "b1505a55-7296-4084-9574-7a4b327cb565",
              displayName: "Tim Lee",
              role: "client",
            },
          ],
          isCurrent: true,
          gmailThreadId: null,
        },
      ],
    ]);
    const docket = todayOf([assoc, job], { threadContext, projects: timLeeProject });
    const card = docket.items[0];
    assert.ok(card);
    assert.equal(card?.subject, "Unassigned");
    assert.equal(card?.brief?.projectId ?? null, null);
    assert.doesNotMatch(card?.subject ?? "", /Tim Lee/);
    assert.ok(selectFounderControls(card!).confirmPerson);
    const view = presentSourceViewer({
      href: LEE_HREF,
      threadId: LEE_THREAD,
      messages: [
        viewerMessage({
          messageId: LEE_INBOUND,
          fromRaw: "External counterpart <lee-vendor@example.test>",
          fromEmail: "lee-vendor@example.test",
          subject: "Re: Cornflower Blue - Yogo Sapphire - Lee",
          sentAt: "2026-09-06T14:00:00.000Z",
        }),
        viewerMessage({
          messageId: LEE_OUTBOUND,
          fromRaw: "Justin Smith <justin@hourglassdiamonds.com>",
          fromEmail: FOUNDER_EMAIL,
        }),
      ],
      request: {
        sources: [{ href: LEE_HREF, label: "Source email" }],
        personLabel: null,
        projectTitle: null,
        why: null,
        facts: [],
        beats: [],
      },
      internalEmails: [FOUNDER_EMAIL],
    });
    assert.ok(view);
    assert.equal(view?.focused.fromDisplayName, "Justin Smith");
    const preview = sourceViewerPreviewFromView(view!, [FOUNDER_EMAIL]);
    assert.notEqual(preview.senderDisplayName, "Justin Smith");
    assert.notEqual(preview.senderEmail, FOUNDER_EMAIL);
    assert.equal(preview.senderDisplayName, "External counterpart");
    assert.equal(preview.senderEmail, "lee-vendor@example.test");
    const emailCard = composeEmailCard(card!, [{ href: LEE_HREF, label: "Source email" }]);
    assert.ok(emailCard);
    assert.equal(emailCard?.senderDisplayName, null);
    assert.equal(emailCard?.senderEmail, null);
  });

  it("founder outbound Unassigned identity prefers inbound counterpart or none", () => {
    const preview = pickExternalSenderPreview(
      {
        focused: {
          messageId: BEE_MSG,
          focused: true,
          fromDisplayName: "Justin Smith",
          fromEmail: FOUNDER_EMAIL,
          to: [],
          cc: [],
          subject: "Re: HGD x Bee Engraving",
          sentAtLabel: "Sep 6",
          body: "I'll email over a label today.",
          snippetFallback: false,
          attachments: [],
        },
        earlier: [
          {
            messageId: "inbound1",
            focused: false,
            fromDisplayName: "Bee Engraving",
            fromEmail: "shop@bee-engraving.test",
            to: [],
            cc: [],
            subject: "Re: HGD x Bee Engraving",
            sentAtLabel: "Sep 5",
            body: "We can start Monday.",
            snippetFallback: false,
            attachments: [],
          },
        ],
        later: [],
      },
      [FOUNDER_EMAIL],
    );
    assert.equal(preview.senderDisplayName, "Bee Engraving");
    assert.notEqual(preview.senderDisplayName, "Justin Smith");
    const none = pickExternalSenderPreview(
      {
        focused: {
          messageId: BEE_MSG,
          focused: true,
          fromDisplayName: "Justin Smith",
          fromEmail: FOUNDER_EMAIL,
          to: [],
          cc: [],
          subject: "Re: HGD x Bee Engraving",
          sentAtLabel: "Sep 6",
          body: "I'll email over a label today.",
          snippetFallback: false,
          attachments: [],
        },
        earlier: [],
        later: [],
      },
      [FOUNDER_EMAIL],
    );
    assert.equal(none.senderDisplayName, null);
    assert.equal(none.senderEmail, null);
    assert.equal(
      vendorOrganizationFromGmailContext({
        thread: {
          fromDisplayName: "Justin Smith",
          fromEmail: FOUNDER_EMAIL,
        },
        vendorDirectory: ["Hourglass"],
        evidenceTexts: ["Hourglass Diamonds"],
      }),
      null,
    );
  });
});
