import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { isActionableToday } from "@/lib/continuum/candidates/founder-attention";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import { fixtureCandidate } from "./fixtures";
import {
  currentActionEligibility,
  isCurrentActionEligible,
  remainingIfCurrentlyActionable,
} from "./current-action-eligibility";
import { reduceWorkLoop } from "./work-loop-state";
import type { CosProjectContext } from "./types";

const NOW = "2026-09-22T20:00:00.000Z";
const FOUNDER_HASH = hashEmail("justin@hourglassdiamonds.com")!;
const NIURKA_EMAIL = "niurka@vlorajewelry.com";
const NIURKA_HASH = hashEmail(NIURKA_EMAIL)!;

const DYLON_STL_ID = "7f1d119f5aa0f06d710b70edf7861c276ce152039469ec198636ddf3429ea997";
const DYLON_STL_REF = "gc1|19fed961d1371aaf|1a0b58c8f6aba78d";
const DYLON_DELIVERY_MSG = "1a0c52c12690a0f5";
const TIM_PRONG_ID = "3c0b4fe3bd6b005c1e2f8a53cf8028efc397046ce278077daa12fcf5db0419cb";
const TIM_WRAPPER = "1a0b18dcd27676a1";
const SARAH_DESIGN_ID = "6bbddea4af6a8ba4e09667d987c537c945a0bea2ee50c78db912022c794eb0ee";
const SARAH_WRAPPER = "1a0c9996db4aef5d";
const NATHAN_CAD_MSG = "1a0ca3b7324175b9";

function gmailRow(
  extra: Partial<ContinuumCandidate> & Pick<ContinuumCandidate, "candidateId">,
): ContinuumCandidate {
  return fixtureCandidate({
    sourceSystem: "gmail",
    proposedTarget: { kind: "none" },
    candidateState: "active",
    reviewStatus: "pending",
    ...extra,
  });
}

function todayOf(
  candidates: ContinuumCandidate[],
  threadContext: Map<string, TodayGmailThreadContext>,
  projects?: Map<string, CosProjectContext>,
) {
  const loop = composeCosOperatingLoop({
    jobs: [],
    candidates,
    projects: projects ?? new Map(),
    nowIso: NOW,
    threadContext,
    knownPeople: [
      {
        personId: "niurka-vendor-contact",
        displayName: "Niurka Lulo",
        roles: ["vendor-contact"] as const,
        organizationName: "Vlora",
        emailHash: NIURKA_HASH,
      },
    ],
    vendorDirectory: ["vlora"],
  });
  return { loop, docket: composeTodayDocket(loop) };
}

function cardHay(
  docket: ReturnType<typeof composeTodayDocket>,
  needle: RegExp,
): string {
  const rows = [
    ...docket.items.map(
      (item) =>
        `${item.subject} ${item.headline} ${item.context ?? ""} ${item.briefing?.nextBody ?? ""} ${item.briefingPacket?.semanticNextActionClass ?? ""} ${item.briefing?.stateChip ?? ""}`,
    ),
    ...docket.watching.map(
      (row) =>
        `${row.title} ${row.detail} ${row.briefing?.nextBody ?? ""} ${row.briefingPacket?.semanticNextActionClass ?? ""} ${row.briefing?.stateChip ?? ""}`,
    ),
  ].filter((row) => needle.test(row));
  return rows.join("\n");
}

function vendorThread(
  threadId: string,
  subject: string,
  messages: TodayGmailThreadContext["messages"],
  extra?: Partial<TodayGmailThreadContext>,
): [string, TodayGmailThreadContext] {
  return [
    threadId,
    {
      subject,
      fromDisplayName: "Niurka Lulo",
      fromEmail: NIURKA_EMAIL,
      messages,
      ...extra,
    },
  ];
}

describe("read-time currentActionEligibility for legacy persisted candidates", () => {
  it("G candidate_state=active alone never establishes Today actionability", () => {
    const active = gmailRow({
      candidateId: DYLON_STL_ID,
      sourceRef: DYLON_STL_REF,
      sourceTimestamp: "2026-09-16T18:00:00.000Z",
      candidateType: "open_job",
      candidateState: "active",
      reviewStatus: "pending",
      payload: {
        kind: "open_job",
        jobKind: "request",
        subject: "STL file",
        detail: "can you send me the stl file for that one as well please",
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_client_request"],
        matchedText: "can you send me the stl file for that one as well please",
      },
    });
    const deferred = { ...active, candidateState: "deferred" as const };
    const later = gmailRow({
      candidateId: DYLON_DELIVERY_MSG,
      sourceRef: `gc1|19fed961d1371aaf|${DYLON_DELIVERY_MSG}`,
      sourceTimestamp: "2026-09-21T18:13:04.000Z",
      candidateType: "open_job",
      payload: {
        kind: "open_job",
        jobKind: "request",
        subject: "Mod 4 CAD + STL",
        detail: "Here is the C025610 Mod 4 CAD + STL.",
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_vendor_waiting"],
        matchedText: "Here is the C025610 Mod 4 CAD + STL.",
      },
    });
    const peers = [active, later];
    assert.equal(currentActionEligibility(active, { peers }).reason, "fulfilled_artifact");
    assert.equal(currentActionEligibility(deferred, { peers }).reason, "fulfilled_artifact");
    assert.equal(isCurrentActionEligible(active, { peers }), false);
    assert.equal(
      isActionableToday({
        currentFounderObligation: false,
        trustworthySource: true,
        actionText: "can you send me the stl file for that one as well please",
        hasMeaningfulEvidence: true,
      }),
      false,
    );
  });

  it("A legacy active open_job plus later artifact delivery is ignored for Today", () => {
    const stale = gmailRow({
      candidateId: DYLON_STL_ID,
      sourceRef: DYLON_STL_REF,
      sourceTimestamp: "2026-09-16T18:00:00.000Z",
      candidateType: "open_job",
      payload: {
        kind: "open_job",
        jobKind: "request",
        subject: "STL file",
        detail: "can you send me the stl file for that one as well please",
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_client_request"],
        matchedText: "can you send me the stl file for that one as well please",
      },
    });
    const delivered = gmailRow({
      candidateId: DYLON_DELIVERY_MSG,
      sourceRef: `gc1|19fed961d1371aaf|${DYLON_DELIVERY_MSG}`,
      sourceTimestamp: "2026-09-21T18:13:04.000Z",
      candidateType: "open_job",
      payload: {
        kind: "open_job",
        jobKind: "request",
        subject: "Mod 4 CAD + STL",
        detail: "Here is the C025610 Mod 4 CAD + STL.",
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_vendor_waiting"],
        matchedText: "Here is the C025610 Mod 4 CAD + STL.",
      },
    });
    assert.equal(isCurrentActionEligible(stale, { peers: [stale, delivered] }), false);
    assert.equal(
      remainingIfCurrentlyActionable(
        {
          matchedText: "can you send me the stl file for that one as well please",
          headline: "can you send me the stl file for that one as well please",
          explanation: "can you send me the stl file for that one as well please",
          recommended: "can you send me the stl file for that one as well please",
        },
        [stale, delivered],
      ),
      null,
    );
    const threadId = "19fed961d1371aaf";
    const { docket } = todayOf(
      [stale, delivered],
      new Map([
        vendorThread(threadId, "RE: HGD x Dylon D.-C025610", [
          {
            messageId: "1a0b58c8f6aba78d",
            sentAt: "2026-09-16T18:00:00.000Z",
            direction: "inbound",
            fromEmailHash: NIURKA_HASH,
          },
          {
            messageId: DYLON_DELIVERY_MSG,
            sentAt: "2026-09-21T18:13:04.000Z",
            direction: "inbound",
            fromEmailHash: NIURKA_HASH,
          },
        ]),
      ]),
    );
    const hay = cardHay(docket, /Dylon|C025610/i);
    assert.match(hay, /founder_review|Mod 4/i);
    assert.doesNotMatch(hay, /send me the stl file/i);
  });

  it("B legacy change request plus later workshop event is vendor_shop", () => {
    const prongText = "Please soften the double-prong change.";
    const workshopText =
      "The stone is going to the workshop via RN08318. Final CAD expected in approximately 10 business days.";
    const threadId = TIM_WRAPPER;
    const stale = gmailRow({
      candidateId: TIM_PRONG_ID,
      sourceRef: `gc1|${threadId}|${TIM_WRAPPER}`,
      sourceTimestamp: "2026-09-19T15:00:00.000Z",
      candidateType: "open_job",
      payload: {
        kind: "open_job",
        jobKind: "request",
        subject: "prong change",
        detail: prongText,
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: { ruleIds: ["explicit_change_request"], matchedText: prongText },
    });
    const duplicate = gmailRow({
      candidateId: "tim-prong-dup-wrapper",
      sourceRef: `gc1|${threadId}|older-wrapper`,
      sourceTimestamp: "2026-09-18T12:00:00.000Z",
      candidateType: "open_job",
      payload: stale.payload,
      evidenceBasis: { ruleIds: ["explicit_change_request"], matchedText: prongText },
    });
    const workshop = gmailRow({
      candidateId: TIM_WRAPPER,
      sourceRef: `gc1|${threadId}|${TIM_WRAPPER}`,
      sourceTimestamp: "2026-09-19T15:00:00.000Z",
      candidateType: "open_job",
      payload: {
        kind: "open_job",
        jobKind: "commitment",
        subject: "Workshop / final CAD",
        detail: workshopText,
        waitingOnActor: "vendor",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: { ruleIds: ["explicit_vendor_commitment"], matchedText: workshopText },
    });
    const forward = gmailRow({
      candidateId: "tim-forward",
      sourceRef: `gc1|${threadId}|tim-forward`,
      sourceTimestamp: "2026-09-18T12:00:00.000Z",
      candidateType: "project_context",
      payload: {
        kind: "project_context",
        topic: "production_instruction",
        value: "Approved — moving forward. Finger size is 9.5. Stone sent.",
      },
      evidenceBasis: {
        ruleIds: ["explicit_founder_commitment"],
        matchedText: "Approved — moving forward. Finger size is 9.5. Stone sent.",
      },
    });
    const peers = [stale, duplicate, workshop, forward];
    assert.equal(isCurrentActionEligible(stale, { peers }), false);
    assert.equal(isCurrentActionEligible(duplicate, { peers }), false);
    const { docket } = todayOf(
      peers,
      new Map([
        vendorThread(threadId, "RE: HGD x Tim/Jenn-C025964", [
          {
            messageId: "older-wrapper",
            sentAt: "2026-09-18T12:00:00.000Z",
            direction: "inbound",
            fromEmailHash: NIURKA_HASH,
          },
          {
            messageId: "tim-forward",
            sentAt: "2026-09-18T12:00:00.000Z",
            direction: "outbound",
            fromEmailHash: FOUNDER_HASH,
          },
          {
            messageId: TIM_WRAPPER,
            sentAt: "2026-09-19T15:00:00.000Z",
            direction: "inbound",
            fromEmailHash: NIURKA_HASH,
          },
        ]),
      ]),
    );
    const hay = cardHay(docket, /Tim|Jenn|C025964/i);
    assert.match(hay, /vendor_shop_wait|WAITING ON SHOP/i);
    assert.doesNotMatch(hay, /soften the double-prong|prong change/i);
  });

  it("C quoted design_basis wrapper timestamp cannot make historical text current", () => {
    const quoted = gmailRow({
      candidateId: SARAH_DESIGN_ID,
      sourceRef: `gc1|1a01c4ee4d198ef0|${SARAH_WRAPPER}`,
      sourceTimestamp: "2026-09-22T14:50:56.000Z",
      candidateType: "project_context",
      payload: {
        kind: "project_context",
        topic: "design_basis",
        value: "same page so I get the CAD correct...",
      },
      evidenceBasis: {
        ruleIds: ["explicit_design_basis"],
        matchedText: "same page so I get the CAD correct...",
      },
    });
    const vendorAsk = gmailRow({
      candidateId: "sarah-vendor-ask",
      sourceRef: "gc1|1a01c4ee4d198ef0|1a0c97a05a456939",
      sourceTimestamp: "2026-09-21T16:00:00.000Z",
      candidateType: "open_job",
      payload: {
        kind: "open_job",
        jobKind: "request",
        subject: "higher-resolution prong reference",
        detail: "Could you send a higher-resolution prong reference so I can continue the CAD?",
        waitingOnActor: "founder",
        dueAt: null,
        createJob: false,
      },
      evidenceBasis: {
        ruleIds: ["explicit_client_request"],
        matchedText: "Could you send a higher-resolution prong reference so I can continue the CAD?",
      },
    });
    const founder = gmailRow({
      candidateId: "sarah-founder-sleuth",
      sourceRef: "gc1|1a01c4ee4d198ef0|1a0c98c3d485f534",
      sourceTimestamp: "2026-09-21T16:20:00.000Z",
      candidateType: "project_context",
      payload: {
        kind: "project_context",
        topic: "founder_follow_through",
        value: "Let me see if I can sleuth it... I'll report back if I can find it later today.",
      },
      evidenceBasis: {
        ruleIds: ["explicit_founder_commitment"],
        matchedText: "Let me see if I can sleuth it... I'll report back if I can find it later today.",
      },
    });
    assert.equal(currentActionEligibility(quoted, { peers: [quoted, vendorAsk, founder] }).reason, "context_only");
    const { docket } = todayOf(
      [quoted, vendorAsk, founder],
      new Map([
        vendorThread("1a01c4ee4d198ef0", "RE: HGD x Sarah-C026143", [
          {
            messageId: "1a0c97a05a456939",
            sentAt: "2026-09-21T16:00:00.000Z",
            direction: "inbound",
            fromEmailHash: NIURKA_HASH,
          },
          {
            messageId: "1a0c98c3d485f534",
            sentAt: "2026-09-21T16:20:00.000Z",
            direction: "outbound",
            fromEmailHash: FOUNDER_HASH,
          },
          {
            messageId: SARAH_WRAPPER,
            sentAt: "2026-09-22T14:50:56.000Z",
            direction: "inbound",
            fromEmailHash: NIURKA_HASH,
          },
        ]),
      ]),
    );
    const hay = cardHay(docket, /Sarah|C026143/i);
    assert.match(hay, /founder_communication|YOUR MOVE|prong|reference|report back|sleuth/i);
    assert.doesNotMatch(hay, /same page so I get the CAD correct/i);
    assert.doesNotMatch(hay, /WAITING ON CLIENT|Sarah has the next turn/i);
  });

  it("D identical quoted matchedText across wrappers is one historical concept and zero current actions", () => {
    const text = "Please soften the double-prong change.";
    const copies = ["wrap-a", "wrap-b", "wrap-c"].map((id) =>
      gmailRow({
        candidateId: `dup-${id}`,
        sourceRef: `gc1|dup-thread|${id}`,
        sourceTimestamp: "2026-09-19T15:00:00.000Z",
        candidateType: "open_job",
        payload: {
          kind: "open_job",
          jobKind: "request",
          subject: "prong change",
          detail: text,
          waitingOnActor: "founder",
          dueAt: null,
          createJob: false,
        },
        evidenceBasis: { ruleIds: ["explicit_change_request"], matchedText: text },
      }),
    );
    for (const row of copies) {
      assert.equal(currentActionEligibility(row, { peers: copies }).reason, "duplicate_wrapper");
      assert.equal(isCurrentActionEligible(row, { peers: copies }), false);
    }
    const { docket } = todayOf(
      copies,
      new Map([
        vendorThread("dup-thread", "RE: HGD x Tim/Jenn-C025964", [
          { messageId: "wrap-a", sentAt: "2026-09-19T14:00:00.000Z", direction: "inbound", fromEmailHash: NIURKA_HASH },
          { messageId: "wrap-b", sentAt: "2026-09-19T14:30:00.000Z", direction: "inbound", fromEmailHash: NIURKA_HASH },
          { messageId: "wrap-c", sentAt: "2026-09-19T15:00:00.000Z", direction: "inbound", fromEmailHash: NIURKA_HASH },
        ]),
      ]),
    );
    assert.doesNotMatch(cardHay(docket, /Tim|Jenn|C025964|prong/i), /soften the double-prong/i);
  });

  it("E vendor promise plus founder acknowledgement is vendor_shop, not client wait", () => {
    const threadId = "1a03a300vendor001";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "grant-forward",
          sourceRef: `gc1|${threadId}|grant-forward`,
          sourceTimestamp: "2026-09-20T12:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "production_instruction",
            value: "Moving forward with all three bands, size 6.25, all platinum, all lab.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Moving forward with all three bands, size 6.25, all platinum, all lab.",
          },
        }),
        gmailRow({
          candidateId: "grant-promise",
          sourceRef: `gc1|${threadId}|1a0c5b1d1a91ebcf`,
          sourceTimestamp: "2026-09-20T16:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: "order confirmation",
            detail: "I'll update the size, place the order, and send the order confirmation.",
            waitingOnActor: "vendor",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_commitment"],
            matchedText: "I'll update the size, place the order, and send the order confirmation.",
          },
        }),
        gmailRow({
          candidateId: "grant-ack",
          sourceRef: `gc1|${threadId}|1a0c5b8416992cbf`,
          sourceTimestamp: "2026-09-20T16:10:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "client_update",
            value: "Perfect:) Thank you!",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Perfect:) Thank you!",
          },
        }),
      ],
      new Map([
        vendorThread(threadId, "RE: HGD x F. Grant-C025885", [
          {
            messageId: "grant-forward",
            sentAt: "2026-09-20T12:00:00.000Z",
            direction: "outbound",
            fromEmailHash: FOUNDER_HASH,
          },
          {
            messageId: "1a0c5b1d1a91ebcf",
            sentAt: "2026-09-20T16:00:00.000Z",
            direction: "inbound",
            fromEmailHash: NIURKA_HASH,
          },
          {
            messageId: "1a0c5b8416992cbf",
            sentAt: "2026-09-20T16:10:00.000Z",
            direction: "outbound",
            fromEmailHash: FOUNDER_HASH,
          },
        ]),
      ]),
    );
    const hay = cardHay(docket, /Grant|C025885/i);
    assert.match(hay, /vendor_shop_wait|WAITING ON SHOP/i);
    assert.doesNotMatch(hay, /WAITING ON CLIENT|Grant has the next turn/i);
  });

  it("F new founder outbound that actually sent the CAD allows client wait", () => {
    const evidence = [
      {
        at: "2026-09-21T14:00:00.000Z",
        label: "Nate",
        summary: "Looking forward to seeing the CAD breakdown.",
        speaker: "client" as const,
        sourceHref: "https://mail.google.com/mail/u/0/#all/client",
        candidateId: "nate-wait",
        timestamp: "2026-09-21T14:00:00.000Z",
      },
      {
        at: "2026-09-21T18:35:00.000Z",
        label: "Shop",
        summary: "Here is the C026176 Mod 1 CAD.",
        speaker: "vendor" as const,
        sourceHref: "https://mail.google.com/mail/u/0/#all/vendor",
        candidateId: "nate-mod1",
        timestamp: "2026-09-21T18:35:00.000Z",
      },
      {
        at: "2026-09-22T17:48:05.000Z",
        label: "You",
        summary: "Here's the latest CAD for the dagger ring — let me know what you think.",
        speaker: "founder" as const,
        sourceHref: "https://mail.google.com/mail/u/0/#all/sent",
        candidateId: NATHAN_CAD_MSG,
        timestamp: "2026-09-22T17:48:05.000Z",
      },
    ];
    const reduced = reduceWorkLoop({
      evidence,
      waitingState: "client",
      communication: "vendor",
      staleInboundSatisfied: true,
    });
    assert.equal(reduced.ballHolder, "client");
    assert.equal(reduced.semanticClass, "client_wait");

    const threadId = "1a09120d797337d9";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "nate-wait",
          sourceRef: `gc1|${threadId}|1a0c52a779c5fb66`,
          sourceTimestamp: "2026-09-21T14:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "CAD breakdown",
            detail: "Looking forward to seeing the CAD breakdown.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "Looking forward to seeing the CAD breakdown.",
          },
        }),
        gmailRow({
          candidateId: "nate-mod1",
          sourceRef: `gc1|${threadId}|1a0c540f4e1e0582`,
          sourceTimestamp: "2026-09-21T18:35:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "Mod 1 CAD",
            detail: "Here is the C026176 Mod 1 CAD.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_waiting"],
            matchedText: "Here is the C026176 Mod 1 CAD.",
          },
        }),
        gmailRow({
          candidateId: NATHAN_CAD_MSG,
          sourceRef: `gc1|${threadId}|${NATHAN_CAD_MSG}`,
          sourceTimestamp: "2026-09-22T17:48:05.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "client_update",
            value: "Here's the latest CAD for the dagger ring — let me know what you think.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Here's the latest CAD for the dagger ring — let me know what you think.",
          },
        }),
      ],
      new Map([
        [
          threadId,
          {
            subject: "RE: HGD x Nate P. (Dagger Ring)-C026176",
            fromDisplayName: "Niurka Lulo",
            fromEmail: NIURKA_EMAIL,
            attachmentFilenames: ["C026176-Mod1.pdf"],
            messages: [
              { messageId: "1a0c52a779c5fb66", sentAt: "2026-09-21T14:00:00.000Z", direction: "inbound" },
              {
                messageId: "1a0c540f4e1e0582",
                sentAt: "2026-09-21T18:35:00.000Z",
                direction: "inbound",
                fromEmailHash: NIURKA_HASH,
              },
              {
                messageId: NATHAN_CAD_MSG,
                sentAt: "2026-09-22T17:48:05.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
            ],
          },
        ],
      ]),
    );
    const hay = cardHay(docket, /Nate|Nathan|C026176/i);
    assert.match(hay, /client_wait|WAITING ON CLIENT/i);
    assert.doesNotMatch(hay, /founder_review|Review the CAD and send Nate/i);
  });

  it("preserves Abbey shipping, Duane vendor CAD promise, and Madi client wait", () => {
    const abbeyThread = "abbey-ship";
    const duaneThread = "duane-cad";
    const madiThread = "madi-wait";
    const { docket } = todayOf(
      [
        gmailRow({
          candidateId: "abbey-address",
          sourceRef: `gc1|${abbeyThread}|abbey-address`,
          sourceTimestamp: "2026-09-21T18:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "request",
            subject: "updated shipping address",
            detail: "Please use this updated shipping address: 123 Oak Street, Austin.",
            waitingOnActor: "founder",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_client_request"],
            matchedText: "Please use this updated shipping address: 123 Oak Street, Austin.",
          },
        }),
        gmailRow({
          candidateId: "duane-cad",
          sourceRef: `gc1|${duaneThread}|duane-cad`,
          sourceTimestamp: "2026-09-21T15:00:00.000Z",
          candidateType: "open_job",
          payload: {
            kind: "open_job",
            jobKind: "commitment",
            subject: "updated CAD",
            detail: "I'll send you cad C026350 as soon as it's available.",
            waitingOnActor: "vendor",
            dueAt: null,
            createJob: false,
          },
          evidenceBasis: {
            ruleIds: ["explicit_vendor_commitment"],
            matchedText: "I'll send you cad C026350 as soon as it's available.",
          },
        }),
        gmailRow({
          candidateId: "madi-ask",
          sourceRef: `gc1|${madiThread}|madi-ask`,
          sourceTimestamp: "2026-09-21T16:00:00.000Z",
          candidateType: "project_context",
          payload: {
            kind: "project_context",
            topic: "client_update",
            value: "Here's the latest CAD — let me know what you think.",
          },
          evidenceBasis: {
            ruleIds: ["explicit_founder_commitment"],
            matchedText: "Here's the latest CAD — let me know what you think.",
          },
        }),
      ],
      new Map([
        [
          abbeyThread,
          {
            subject: "RE: HGD x Abbey-C026137",
            fromDisplayName: "Abbey",
            fromEmail: "abbey@client.test",
            messages: [
              {
                messageId: "abbey-address",
                sentAt: "2026-09-21T18:00:00.000Z",
                direction: "inbound",
              },
            ],
          },
        ],
        vendorThread(duaneThread, "RE: HGD x Duane-C026350", [
          {
            messageId: "duane-cad",
            sentAt: "2026-09-21T15:00:00.000Z",
            direction: "inbound",
            fromEmailHash: NIURKA_HASH,
          },
        ]),
        [
          madiThread,
          {
            subject: "RE: HGD x Madi-C026000",
            fromDisplayName: "Madi",
            fromEmail: "madi@client.test",
            messages: [
              {
                messageId: "madi-ask",
                sentAt: "2026-09-21T16:00:00.000Z",
                direction: "outbound",
                fromEmailHash: FOUNDER_HASH,
              },
            ],
          },
        ],
      ]),
    );
    assert.match(cardHay(docket, /Abbey|C026137/i), /Ship|shipping address|YOUR MOVE|founder/i);
    assert.match(cardHay(docket, /Duane|C026350/i), /vendor_shop_wait|WAITING ON SHOP|CAD/i);
    assert.match(cardHay(docket, /Madi|C026000/i), /client_wait|WAITING ON CLIENT/i);
  });
});
