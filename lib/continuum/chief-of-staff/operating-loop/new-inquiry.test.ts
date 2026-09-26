import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChiefOfStaffToday } from "../../../../app/executive-dashboard/concierge/components/chief-of-staff-today";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { TodayGmailThreadContext, TodayKnownPerson } from "@/lib/continuum/candidates/founder-attention";
import { proposeGmailCandidates } from "@/lib/continuum/gmail/candidates/propose";
import {
  NEW_COMMERCIAL_INQUIRY_RULE,
  NEW_PROJECT_CONTEXT_TOPIC,
  REACTIVATED_COMMERCIAL_WORK_RULE,
} from "@/lib/continuum/gmail/candidates/new-project";
import { classifySourceCommunication } from "@/lib/continuum/source-events/classify";
import { projectGmailSourceEvents } from "@/lib/continuum/source-events/gmail";
import { isCurrentWorkSourceClass } from "@/lib/continuum/source-events/types";
import { composeCosOperatingLoop } from "./compose";
import { COS_DOCKET_VISIBLE_LIMIT, composeTodayDocket } from "./docket";
import {
  COS_LOOP_NOW,
  COS_LOOP_PROJECT_A,
  COS_LOOP_PROJECT_B,
  fixtureJob,
  fixtureProjects,
} from "./fixtures";
import { selectNewInquirySurface } from "./new-inquiry";

const NOW = "2026-09-26T13:36:19.000Z";
const SENT = "2026-09-26T12:45:19.000Z";
const THREAD = "1a0ddbfb36055752";
const MESSAGE = "1a0ddbfb36055752";
const SENDER = "new.inquiry@example.test";
const SUBJECT = "Custom Engagement Ring Inquiry - 4ct Lab Round, Hidden Halo";
const BODY =
  "I am looking to have a custom engagement ring made. 4 ct lab-grown round, hidden halo. Could you share an estimated price, timing, the custom process, and a consultation?";

const EMPTY_WORLD = {
  people: [],
  projects: [],
  internalEmailHashes: [],
};

function thread(input: {
  threadId: string;
  messageId: string;
  sentAt: string;
  subject: string;
  body: string;
  email: string;
  labels?: readonly string[];
  direction?: "inbound" | "outbound";
}): TodayGmailThreadContext {
  return {
    subject: input.subject,
    fromEmail: input.email,
    messages: [
      {
        messageId: input.messageId,
        sentAt: input.sentAt,
        direction: input.direction ?? "inbound",
        labelIds: input.labels ?? ["INBOX", "CATEGORY_PERSONAL"],
        fromEmailHash: hashEmail(input.email),
        subject: input.subject,
        plaintext: input.body,
      },
    ],
  };
}

function ringThread(): TodayGmailThreadContext {
  return thread({
    threadId: THREAD,
    messageId: MESSAGE,
    sentAt: SENT,
    subject: SUBJECT,
    body: BODY,
    email: SENDER,
  });
}

describe("new commercial inquiry visibility", () => {
  it("classifies the engagement-ring request as a new inquiry and does not mint a person or project", () => {
    assert.equal(
      classifySourceCommunication({
        actor: "client",
        direction: "inbound",
        subject: SUBJECT,
        authorOwnedText: BODY,
      }),
      "new_commercial_inquiry",
    );
    assert.equal(
      classifySourceCommunication({
        actor: "client",
        direction: "inbound",
        subject: SUBJECT,
        authorOwnedText: "",
      }),
      "new_commercial_inquiry",
    );
    assert.equal(isCurrentWorkSourceClass("new_commercial_inquiry"), false);
    assert.equal(
      classifySourceCommunication({
        actor: "client",
        direction: "inbound",
        subject: "Thanks!",
        authorOwnedText: "Thanks!",
      }),
      "client_replies_nonblocking",
    );
    assert.equal(
      classifySourceCommunication({
        actor: "client",
        direction: "inbound",
        subject: "Updated CAD",
        authorOwnedText: "Can you send the updated CAD?",
      }),
      "client_requests",
    );

    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: EMPTY_WORLD,
      evidence: [
        {
          indexed: {
            messageId: MESSAGE,
            threadId: THREAD,
            sentAt: SENT,
            indexedAt: "2026-09-26T12:46:03.653Z",
            subject: SUBJECT,
            fromEmailHash: hashEmail(SENDER),
            toEmailHashes: [],
            ccEmailHashes: [],
            bccEmailHashes: [],
            direction: "inbound",
            labelIds: ["INBOX"],
            hasAttachments: false,
            sourceSystem: "gmail",
          },
          plaintext: BODY,
          fromEmailHash: hashEmail(SENDER),
        },
      ],
    });
    const inquiry = proposed.candidates.find(
      (row) =>
        row.payload.kind === "project_context" &&
        row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC,
    );
    assert.ok(inquiry);
    assert.ok(inquiry.evidenceBasis.ruleIds.includes(NEW_COMMERCIAL_INQUIRY_RULE));
    assert.equal(
      inquiry.evidenceBasis.ruleIds.includes(REACTIVATED_COMMERCIAL_WORK_RULE),
      false,
    );
    assert.equal(inquiry.payload.kind === "project_context" && inquiry.payload.value, "Custom Engagement Ring");
    for (const row of proposed.candidates) {
      assert.equal(row.canonical, false);
      assert.equal(row.automaticApply, false);
      if (row.payload.kind === "person_association") {
        assert.equal(row.payload.mintPerson, false);
        assert.equal(row.proposedTarget.kind === "person" && row.proposedTarget.personId, null);
      }
      if (row.proposedTarget.kind === "project" || row.proposedTarget.kind === "project_spec") {
        assert.equal(row.proposedTarget.projectId ?? null, null);
      }
    }

    const events = projectGmailSourceEvents({
      threadContext: new Map([[THREAD, ringThread()]]),
      candidates: proposed.candidates,
    });
    assert.equal(events.length, 1);
    assert.equal(events[0]?.semanticClass, "new_commercial_inquiry");
    assert.equal(events[0]?.sourceType, "gmail");
    assert.equal(events[0]?.projectId, null);
  });

  it("shows the inquiry before Up Next, keeps three founder reviews, and rejects the negative cases", () => {
    const contexts = new Map<string, TodayGmailThreadContext>([
      [THREAD, ringThread()],
      [
        "bbbbbbbbbb01",
        thread({
          threadId: "bbbbbbbbbb01",
          messageId: "bbbbbbbbbb11",
          sentAt: "2026-09-26T12:00:00.000Z",
          subject: "Thanks!",
          body: "Thanks!",
          email: "thanks@example.test",
        }),
      ],
      [
        "bbbbbbbbbb02",
        thread({
          threadId: "bbbbbbbbbb02",
          messageId: "bbbbbbbbbb12",
          sentAt: "2026-09-26T12:10:00.000Z",
          subject: "Re: necklace",
          body: "Can you send the updated CAD?",
          email: "known.client@example.test",
        }),
      ],
      [
        "bbbbbbbbbb03",
        thread({
          threadId: "bbbbbbbbbb03",
          messageId: "bbbbbbbbbb13",
          sentAt: "2026-09-26T12:20:00.000Z",
          subject: "Shop update",
          body: "The ring is in the workshop.",
          email: "shop@vendor.example",
        }),
      ],
      [
        "bbbbbbbbbb04",
        thread({
          threadId: "bbbbbbbbbb04",
          messageId: "bbbbbbbbbb14",
          sentAt: "2026-09-26T12:30:00.000Z",
          subject: "Weekly jewelry digest",
          body: "Unsubscribe from this newsletter about rings.",
          email: "news@example.test",
          labels: ["INBOX", "CATEGORY_PROMOTIONS"],
        }),
      ],
      [
        "bbbbbbbbbb05",
        thread({
          threadId: "bbbbbbbbbb05",
          messageId: "bbbbbbbbbb15",
          sentAt: "2026-09-26T11:00:00.000Z",
          subject: "Hello",
          body: "Hope you are well.",
          email: "ambiguous@example.test",
        }),
      ],
      [
        THREAD,
        {
          ...ringThread(),
          messages: [
            ...(ringThread().messages ?? []),
            {
              messageId: "1a0ddbfb36055753",
              sentAt: "2026-09-26T12:50:00.000Z",
              direction: "inbound" as const,
              labelIds: ["INBOX"],
              fromEmailHash: hashEmail(SENDER),
              subject: SUBJECT,
              plaintext: BODY,
            },
          ],
        },
      ],
    ]);

    const known: TodayKnownPerson[] = [
      {
        personId: "known-client",
        displayName: "Known Client",
        roles: ["client"],
        emailHash: hashEmail("known.client@example.test")!,
      },
      {
        personId: "vendor",
        displayName: "Shop",
        roles: ["vendor-contact"],
        emailHash: hashEmail("shop@vendor.example")!,
      },
    ];
    const projects = fixtureProjects();
    projects.set(COS_LOOP_PROJECT_A, {
      ...projects.get(COS_LOOP_PROJECT_A)!,
      gmailThreadId: "bbbbbbbbbb02",
    });

    const surface = selectNewInquirySurface({
      nowIso: NOW,
      threadContext: contexts,
      knownPeople: known,
      projects,
    });
    assert.equal(surface.count, 1);
    assert.equal(surface.heading, "NEW INQUIRY");
    assert.equal(surface.featured?.title, "Custom Engagement Ring");
    assert.equal(surface.featured?.detail, "4 ct lab round · hidden halo");
    assert.equal(surface.featured?.status, "New contact · No client or project match");
    assert.equal(surface.featured?.receivedLabel, "Received 51 min ago");
    assert.equal(surface.featured?.reviewLabel, "Review inquiry");
    assert.match(surface.featured?.reviewHref ?? "", /mail\.google\.com/);
    assert.equal(surface.featured?.title.includes("Unassigned"), false);
    assert.deepEqual(surface.threadIds, [THREAD]);

    const projectC = "cccccccc-aaaa-4aaa-8aaa-cccccccccccc";
    projects.set(projectC, {
      projectId: projectC,
      title: "Third review",
      personName: "Mara",
      people: [{ personId: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa", displayName: "Mara" }],
      isCurrent: true,
    });
    const jobs = [
      fixtureJob({
        jobId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc0",
        subject: "Send revision 0 for a concise founder action",
        projectId: COS_LOOP_PROJECT_A,
      }),
      fixtureJob({
        jobId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
        subject: "Send revision 1 for a concise founder action",
        projectId: COS_LOOP_PROJECT_B,
      }),
      fixtureJob({
        jobId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2",
        subject: "Send revision 2 for a concise founder action",
        projectId: projectC,
      }),
    ];
    const ringOnly = new Map<string, TodayGmailThreadContext>([[THREAD, contexts.get(THREAD)!]]);
    const baseline = composeTodayDocket(
      composeCosOperatingLoop({
        jobs,
        projects,
        nowIso: NOW,
        newMutationId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      }),
    );
    const withInquiry = composeTodayDocket(
      composeCosOperatingLoop({
        jobs,
        projects,
        nowIso: NOW,
        knownPeople: known,
        threadContext: ringOnly,
        newMutationId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      }),
    );
    assert.equal(COS_DOCKET_VISIBLE_LIMIT, 3);
    assert.equal(baseline.items.length, 3);
    assert.equal(withInquiry.items.length, 3);
    assert.deepEqual(
      withInquiry.items.map((item) => item.id),
      baseline.items.map((item) => item.id),
    );
    assert.equal(withInquiry.newInquiries?.featured?.threadId, THREAD);
    assert.equal(
      withInquiry.items.some((item) =>
        `${item.subject} ${item.headline}`.includes("Unassigned"),
      ),
      false,
    );

    const html = renderToStaticMarkup(
      createElement(ChiefOfStaffToday, {
        docket: withInquiry,
      }),
    );
    const inquiryAt = html.indexOf("NEW INQUIRY");
    const upNextAt = html.indexOf("Up next");
    assert.ok(inquiryAt >= 0);
    assert.ok(upNextAt > inquiryAt);
    assert.match(html, /Custom Engagement Ring/);
    assert.match(html, /4 ct lab round · hidden halo/);
    assert.match(html, /New contact · No client or project match/);
    assert.match(html, /Received 51 min ago/);
    assert.match(html, /Review inquiry/);
    assert.equal([...html.matchAll(/hg-cos-check/g)].length, 3);
    assert.doesNotMatch(html, />Unassigned</);
  });

  it("features the oldest inquiry, hides a dismissed or associated thread, and does not duplicate", () => {
    const older = "aaaaaaaaaa01";
    const contexts = new Map<string, TodayGmailThreadContext>([
      [
        older,
        thread({
          threadId: older,
          messageId: "aaaaaaaaaa11",
          sentAt: "2026-09-26T10:00:00.000Z",
          subject: "Custom Necklace Inquiry - pearl pendant",
          body: "I am looking to have a custom necklace made.",
          email: "older@example.test",
        }),
      ],
      [THREAD, ringThread()],
    ]);
    const open = selectNewInquirySurface({ nowIso: NOW, threadContext: contexts });
    assert.equal(open.count, 2);
    assert.equal(open.heading, "NEW INQUIRIES · 2");
    assert.equal(open.featured?.threadId, older);
    assert.equal(open.featured?.title, "Custom Necklace");
    assert.equal(open.moreLabel, "+1 more");

    const proposed = proposeGmailCandidates({
      createdAt: NOW,
      world: EMPTY_WORLD,
      evidence: [
        {
          indexed: {
            messageId: MESSAGE,
            threadId: THREAD,
            sentAt: SENT,
            indexedAt: NOW,
            subject: SUBJECT,
            fromEmailHash: hashEmail(SENDER),
            toEmailHashes: [],
            ccEmailHashes: [],
            bccEmailHashes: [],
            direction: "inbound",
            labelIds: ["INBOX"],
            hasAttachments: false,
            sourceSystem: "gmail",
          },
          plaintext: BODY,
          fromEmailHash: hashEmail(SENDER),
        },
      ],
    });
    const dismissed = proposed.candidates.map((row) =>
      row.payload.kind === "project_context" && row.payload.topic === NEW_PROJECT_CONTEXT_TOPIC
        ? { ...row, reviewStatus: "discarded" as const }
        : row,
    );
    const hidden = selectNewInquirySurface({
      nowIso: NOW,
      threadContext: new Map([[THREAD, ringThread()]]),
      candidates: dismissed,
    });
    assert.equal(hidden.count, 0);

    const associated = proposed.candidates.map((row) =>
      row.proposedTarget.kind === "person"
        ? {
            ...row,
            proposedTarget: { ...row.proposedTarget, personId: "existing-person" },
          }
        : row,
    );
    const routed = selectNewInquirySurface({
      nowIso: NOW,
      threadContext: new Map([[THREAD, ringThread()]]),
      candidates: associated,
    });
    assert.equal(routed.count, 0);
  });
});
