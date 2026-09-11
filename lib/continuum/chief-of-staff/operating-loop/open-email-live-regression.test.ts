/**
 * Live-data Open Email regression.
 * Mirrors the Sep 9, 2026 founder failure: stored candidates pointed only at
 * the Morning Brief thread, were not tagged generated_founder_operating_brief,
 * and project.gmailThreadId was not involved.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "@/lib/continuum/client-memory/hashes";
import { GENERATED_FOUNDER_OPERATING_BRIEF_RULE } from "@/lib/continuum/gmail/candidates/generated-source";
import { withIndexedGeneratedOperatingMail } from "@/lib/continuum/gmail/candidates/tag-stored-generated";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { composeConciergeBrief } from "./moderator";
import { composeTodayDocket } from "./docket";
import { selectFounderControls } from "./founder-actions";
import { fixtureCandidate, COS_LOOP_NOW, COS_LOOP_PROJECT_A, COS_LOOP_PERSON_A } from "./fixtures";
import { COS_OPERATING_LOOP_CONTRACT_VERSION, type CosProjectContext } from "./types";

const LIVE_BRIEF_THREAD = "1a085d41ae9efcf6";
const LIVE_BRIEF_MSG = "1a085d41ae9efcf6";
const LIVE_BRIEF_HREF = `https://mail.google.com/mail/u/0/#all/${LIVE_BRIEF_THREAD}/${LIVE_BRIEF_MSG}`;
const CLIENT_THREAD = "1a04a565e20ee5f5";
const CLIENT_MSG = "1a082e6c4dcb5849";
const CLIENT_HREF = `https://mail.google.com/mail/u/0/#all/${CLIENT_THREAD}/${CLIENT_MSG}`;
const CADENCE_HASH = hashEmail("cadence@hourglass.test")!;
const CLIENT_HASH = hashEmail("jen@client.test")!;
const LIVE_AT = "2026-09-09T11:01:04.000Z";

function liveUntaggedBriefCandidates(): ContinuumCandidate[] {
  const sourceRef = `gc1|${LIVE_BRIEF_THREAD}|${LIVE_BRIEF_MSG}`;
  return [
    fixtureCandidate({
      candidateId: "4393b28561d0106c285d9175d1df5a321cfba5265d4e05029696744aed22078a",
      sourceSystem: "gmail",
      sourceRef,
      sourceTimestamp: LIVE_AT,
      proposedTarget: { kind: "none" },
      candidateType: "follow_up",
      payload: {
        kind: "follow_up",
        text: "follow-up window",
        dueAt: null,
        sourceTimestamp: LIVE_AT,
      },
      evidenceBasis: {
        ruleIds: ["explicit_follow_up"],
        matchedText: "follow-up window",
      },
    }),
    fixtureCandidate({
      candidateId: "cce84f2776845be7c7f6f114abfdd57504ecce0b216e09657d646716c9d5bb89",
      sourceSystem: "gmail",
      sourceRef,
      sourceTimestamp: LIVE_AT,
      proposedTarget: { kind: "person", personId: null },
      candidateType: "person_association",
      confidence: "medium",
      payload: {
        kind: "person_association",
        displayName: null,
        emailHash: "unresolved",
        mintPerson: false,
        mergePersons: false,
      },
      evidenceBasis: {
        ruleIds: ["unresolved_email_hash"],
        matchedText: "",
      },
    }),
  ];
}

function controlsFor(candidates: readonly ContinuumCandidate[], projects = new Map<string, CosProjectContext>()) {
  const moderated = composeConciergeBrief({
    candidates,
    jobs: [],
    projects,
    nowIso: COS_LOOP_NOW,
    top5: [],
  });
  const docket = composeTodayDocket({
    contractVersion: COS_OPERATING_LOOP_CONTRACT_VERSION,
    status: "active",
    heading: "Up next",
    quietDetail: null,
    top5: [],
    remainingCount: 0,
    brief: moderated.brief,
    watching: moderated.watching,
    recap: [],
    anomalies: [],
    proposedActions: [],
    needsYourDecision: [],
    worthKnowing: [],
  });
  const item = docket.items[0];
  assert.ok(item);
  return {
    item,
    brief: moderated.brief[0],
    controls: selectFounderControls(item),
  };
}

describe("Open Email live stored-state regression", () => {
  it("hides Open Email for the Unassigned Morning Brief item after sender-hash tagging", () => {
    const stored = liveUntaggedBriefCandidates();
    assert.equal(
      stored.every((row) => !row.evidenceBasis.ruleIds.includes(GENERATED_FOUNDER_OPERATING_BRIEF_RULE)),
      true,
    );

    const before = controlsFor(stored);
    assert.equal(before.item.subject, "Unassigned");
    assert.equal(before.brief?.projectId ?? null, null);
    assert.equal(before.brief?.canonicalGmailThreadId ?? null, null);
    assert.equal(before.controls.openEmail?.href, LIVE_BRIEF_HREF);
    assert.ok((before.brief?.evidence.length ?? 0) > 0);

    const tagged = withIndexedGeneratedOperatingMail(
      stored,
      new Map([[LIVE_BRIEF_MSG, CADENCE_HASH]]),
      [CADENCE_HASH],
    );
    assert.equal(
      tagged.every((row) => row.evidenceBasis.ruleIds.includes(GENERATED_FOUNDER_OPERATING_BRIEF_RULE)),
      true,
    );

    const after = controlsFor(tagged);
    assert.equal(after.item.subject, "Unassigned");
    assert.equal(after.controls.openEmail, null);
    assert.equal(after.controls.emailSources.length, 0);
    assert.ok((after.brief?.evidence.length ?? 0) > 0);
    assert.equal(
      after.brief?.actions.some((action) => action.kind === "open_email"),
      false,
    );
  });

  it("opens ingested client Gmail when an Unassigned Brief restates that follow-up", () => {
    const stored: ContinuumCandidate[] = [
      ...liveUntaggedBriefCandidates(),
      fixtureCandidate({
        candidateId: "cand-client-follow",
        sourceSystem: "gmail",
        sourceRef: `gc1|${CLIENT_THREAD}|${CLIENT_MSG}`,
        sourceTimestamp: "2026-09-08T15:00:00.000Z",
        proposedTarget: {
          kind: "project",
          projectId: COS_LOOP_PROJECT_A,
        },
        candidateType: "follow_up",
        payload: {
          kind: "follow_up",
          text: "follow-up window",
          dueAt: null,
          sourceTimestamp: "2026-09-08T15:00:00.000Z",
        },
        evidenceBasis: {
          ruleIds: ["explicit_follow_up"],
          matchedText: "follow-up window",
        },
      }),
    ];
    const tagged = withIndexedGeneratedOperatingMail(
      stored,
      new Map([
        [LIVE_BRIEF_MSG, CADENCE_HASH],
        [CLIENT_MSG, CLIENT_HASH],
      ]),
      [CADENCE_HASH],
    );
    const briefFollowUp = tagged.find(
      (row) => row.candidateId === stored[0]?.candidateId,
    );
    assert.deepEqual(briefFollowUp?.evidenceBasis.supportingSourceRefs, [
      `gc1|${CLIENT_THREAD}|${CLIENT_MSG}`,
    ]);
    assert.equal(briefFollowUp?.sourceRef, `gc1|${LIVE_BRIEF_THREAD}|${LIVE_BRIEF_MSG}`);

    const moderated = composeConciergeBrief({
      candidates: tagged,
      jobs: [],
      projects: new Map(),
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    const docket = composeTodayDocket({
      contractVersion: COS_OPERATING_LOOP_CONTRACT_VERSION,
      status: "active",
      heading: "Up next",
      quietDetail: null,
      top5: [],
      remainingCount: 0,
      brief: moderated.brief,
      watching: moderated.watching,
      recap: [],
      anomalies: [],
      proposedActions: [],
      needsYourDecision: [],
      worthKnowing: [],
    });
    const unassigned = docket.items.find((item) => item.subject === "Unassigned");
    assert.ok(unassigned);
    const controls = selectFounderControls(unassigned);
    assert.equal(controls.openEmail?.href, CLIENT_HREF);
    assert.equal(controls.emailSources.some((row) => row.href === LIVE_BRIEF_HREF), false);
    assert.ok(
      (unassigned.brief?.evidence ?? []).some((beat) => beat.sourceHref === LIVE_BRIEF_HREF),
    );
  });

  it("selects the surviving client sourceRef when project.gmailThreadId is the Brief thread", () => {
    const stored: ContinuumCandidate[] = [
      fixtureCandidate({
        candidateId: "cand-client",
        sourceSystem: "gmail",
        sourceRef: `gc1|${CLIENT_THREAD}|${CLIENT_MSG}`,
        sourceTimestamp: "2026-09-08T15:00:00.000Z",
        proposedTarget: {
          kind: "project_spec",
          projectId: COS_LOOP_PROJECT_A,
          fieldName: "finger_size",
        },
        candidateType: "structured_spec",
        candidateState: "conflict",
        payload: {
          kind: "structured_spec",
          fieldName: "finger_size",
          proposedValue: "11",
          currentValue: "12.5",
          conflict: true,
        },
        evidenceBasis: {
          ruleIds: ["spec_conflict_review_required", "explicit_client_request"],
          matchedText: "finger size 11",
        },
      }),
      fixtureCandidate({
        candidateId: "cand-brief",
        sourceSystem: "gmail",
        sourceRef: `gc1|${LIVE_BRIEF_THREAD}|${LIVE_BRIEF_MSG}`,
        sourceTimestamp: LIVE_AT,
        proposedTarget: {
          kind: "project_spec",
          projectId: COS_LOOP_PROJECT_A,
          fieldName: "finger_size",
        },
        candidateType: "structured_spec",
        candidateState: "conflict",
        payload: {
          kind: "structured_spec",
          fieldName: "finger_size",
          proposedValue: "11",
          currentValue: "12.5",
          conflict: true,
        },
        evidenceBasis: {
          ruleIds: ["spec_conflict_review_required", "explicit_client_request"],
          matchedText: "finger size 11",
        },
      }),
    ];
    const tagged = withIndexedGeneratedOperatingMail(
      stored,
      new Map([
        [LIVE_BRIEF_MSG, CADENCE_HASH],
        [CLIENT_MSG, CLIENT_HASH],
      ]),
      [CADENCE_HASH],
    );
    const projects = new Map<string, CosProjectContext>([
      [
        COS_LOOP_PROJECT_A,
        {
          projectId: COS_LOOP_PROJECT_A,
          title: "Lee / Spiegel",
          personName: "Jen Spiegel",
          people: [{ personId: COS_LOOP_PERSON_A, displayName: "Jen Spiegel", role: "client" }],
          isCurrent: true,
          lifecycleStage: "production",
          gmailThreadId: LIVE_BRIEF_THREAD,
          specs: [
            { fieldName: "finger_size", value: "12.5" },
            { fieldName: "metal", value: "Platinum" },
          ],
        },
      ],
    ]);
    const moderated = composeConciergeBrief({
      candidates: tagged,
      jobs: [],
      projects,
      nowIso: COS_LOOP_NOW,
      top5: [],
    });
    assert.equal(moderated.brief.length, 1);
    assert.equal(moderated.brief[0]?.canonicalGmailThreadId, LIVE_BRIEF_THREAD);
    const openEmail = moderated.brief[0]?.actions.find((action) => action.kind === "open_email");
    assert.equal(openEmail?.href, CLIENT_HREF);
    assert.equal(
      (moderated.brief[0]?.evidence ?? []).some((beat) => beat.sourceHref === LIVE_BRIEF_HREF),
      true,
    );
  });
});
