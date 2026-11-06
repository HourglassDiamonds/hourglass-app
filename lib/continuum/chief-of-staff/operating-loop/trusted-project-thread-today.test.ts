import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import { composeCosOperatingLoop } from "./compose";
import { composeTodayDocket } from "./docket";
import type { CosProjectContext } from "./types";

const PROJECT = "17ef9d5b-39d2-48bf-85f6-93209a4c4e38";
const PERSON = "2cd354da-9c7b-4f71-84c3-4bdf0945dcc4";
const THREAD = "1a15fb0c9b520621";
const INVOICE = "f37af8a7-1659-4a83-bdaa-45ae5983604d";
const SHIPMENT = "94e2373e-3257-4ada-8592-1c574349e11f";

function job(jobId: string, subject: string): ProjectJob {
  return {
    jobId,
    projectId: PROJECT,
    kind: "required_action",
    subject,
    detail: null,
    waitingOnActor: "founder",
    associatedPersonId: PERSON,
    state: "open",
    dueAt: "2026-11-06T17:00:00.000Z",
    deferredUntil: null,
    resolvedAt: null,
    cancelledAt: null,
    createdAt: "2026-11-05T20:00:00.000Z",
    updatedAt: "2026-11-05T20:00:00.000Z",
    createdBy: "founder",
    sourceSystem: "concierge-manual",
    sourceRef: `concierge-manual:${jobId}`,
    createdMutationId: jobId,
    attentionMode: "action",
    activationAt: null,
    checkpointAt: null,
    attentionMetadata: null,
  };
}

const project: CosProjectContext = {
  projectId: PROJECT,
  title: "Morgan Jines — Marquise",
  personName: "Morgan Jines",
  people: [{ personId: PERSON, displayName: "Morgan Jines", role: "client", organizationName: null }],
  isCurrent: true,
  lifecycleStage: "design",
  specs: [],
  gmailThreadId: null,
};

const thread: TodayGmailThreadContext = {
  subject: "Morgan marquise",
  messages: [
    {
      messageId: "1a15fb0c9b520630",
      sentAt: "2026-11-05T14:49:47.000Z",
      direction: "inbound",
      fromEmailHash: "a".repeat(64),
      toEmailHashes: ["f".repeat(64)],
      subject: "Morgan marquise",
    },
    {
      messageId: "1a15fb0c9b520631",
      sentAt: "2026-11-05T14:58:46.000Z",
      direction: "outbound",
      fromEmailHash: "f".repeat(64),
      toEmailHashes: ["a".repeat(64)],
      subject: "Re: Morgan marquise",
    },
  ],
};

describe("Morgan trusted correspondence in Today", () => {
  it("keeps canonical founder actions stable while recognizing the answered thread", () => {
    const build = () => composeCosOperatingLoop({
      jobs: [
        job(INVOICE, "Send Morgan's invoice"),
        job(SHIPMENT, "Ship Morgan's approved marquise to Niurka with James Bowron's and Sarah's materials"),
      ],
      projects: new Map([[PROJECT, project]]),
      candidates: [],
      nowIso: "2026-11-06T16:00:00.000Z",
      threadContext: new Map([[THREAD, thread]]),
      trustedProjectThreads: new Map([[THREAD, PROJECT]]),
    });
    const first = build();
    const second = build();
    assert.deepEqual(first.associatedGmailThreadsByProject?.get(PROJECT), [THREAD]);
    assert.deepEqual(second.associatedGmailThreadsByProject?.get(PROJECT), [THREAD]);

    const docket = composeTodayDocket(first);
    const founder = docket.sections?.find((section) => section.id === "founder")?.items ?? [];
    assert.deepEqual(founder.map((item) => item.jobId).filter(Boolean).sort(), [INVOICE, SHIPMENT].sort());
    assert.ok(founder.every((item) => item.stateLabel === "FOUNDER ACTION"));
    assert.ok(founder.every((item) => item.lifecycle === "design"));
    assert.ok(founder.every((item) => item.ballHolder === "founder"));
    assert.ok(founder.every((item) => item.packet?.sourceRefs.some((ref) => ref.includes(THREAD))));
    const rendered = JSON.stringify(docket).toLowerCase();
    assert.doesNotMatch(rendered, /morgan[^\"]*(?:needs a reply|awaiting (?:our|founder) response|reply needed)/);
    assert.doesNotMatch(rendered, /c026937/);
  });
});
