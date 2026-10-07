import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { collectCanonicalActionables } from "./collect";
import { fixtureJob } from "./fixtures";
import { classifySourceCommunication } from "@/lib/continuum/source-events/classify";
import { projectCurrentWork } from "./current-work";
import { isExternalPromiseFollowUpDue } from "./docket";
import type { SourceCommunicationEvent } from "@/lib/continuum/source-events/types";

const NOW = "2026-10-07T14:00:00.000Z";
const PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function sourceEvent(input: {
  id: string;
  actor: SourceCommunicationEvent["actor"];
  direction: SourceCommunicationEvent["direction"];
  text: string;
  timestamp?: string;
  attachments?: readonly string[];
}): SourceCommunicationEvent {
  return {
    sourceType: "gmail",
    sourceRef: `gc1|actionability-thread|${input.id}`,
    messageId: input.id,
    threadId: "actionability-thread",
    timestamp: input.timestamp ?? "2026-10-06T14:00:00.000Z",
    direction: input.direction,
    actor: input.actor,
    subject: "HGD x Actionability-C026137",
    authorOwnedText: input.text,
    quotedText: "",
    attachmentFilenames: input.attachments ?? [],
    hasAttachments: Boolean(input.attachments?.length),
    cadIds: ["C026137"],
    orderIds: [],
    productionJobIds: [],
    personLabel: "Abbey",
    projectId: PROJECT_ID,
    workLoopId: `project:${PROJECT_ID}`,
    semanticClass: classifySourceCommunication({
      actor: input.actor,
      direction: input.direction,
      subject: "HGD x Actionability-C026137",
      authorOwnedText: input.text,
      attachmentFilenames: input.attachments,
      hasAttachments: Boolean(input.attachments?.length),
    }),
    evidenceExcerpt: input.text,
    workIdentityBasis: "project",
    provenance: "indexed_gmail+live_operational_fact",
  };
}

describe("Today actionability polish", () => {
  it("A: keeps an intake without a distinct founder action in Intake only", () => {
    const intakeId = randomUUID();
    const shell = fixtureJob({
      jobId: randomUUID(),
      projectId: null,
      subject: "Website inquiry — Justin Smith",
      sourceSystem: "continuum",
      sourceRef: `website-intake:${intakeId}`,
      createdBy: "website-intake",
    });
    const result = collectCanonicalActionables({ jobs: [shell], projects: new Map(), nowIso: NOW });
    assert.deepEqual(result, []);
  });

  it("B: retains a distinct founder callback while the intake shell stays in Intake", () => {
    const intakeId = randomUUID();
    const shell = fixtureJob({
      jobId: randomUUID(), projectId: null, subject: "Website inquiry — Justin Smith",
      sourceSystem: "continuum", sourceRef: `website-intake:${intakeId}`, createdBy: "website-intake",
    });
    const callback = fixtureJob({
      jobId: randomUUID(), projectId: null, subject: "Call Justin Smith about the website inquiry",
      sourceSystem: "concierge-manual", sourceRef: `founder-callback:${intakeId}`, createdBy: "founder",
    });
    const result = collectCanonicalActionables({ jobs: [shell, callback], projects: new Map(), nowIso: NOW });
    assert.deepEqual(result.map((row) => row.id), [callback.jobId]);
  });

  it("C: holds an external promise with the client until its promised date", () => {
    const promise = sourceEvent({
      id: "client-promise",
      actor: "client",
      direction: "inbound",
      text: "I’ll send over the pic of the pendant size tomorrow.",
    });
    const projection = projectCurrentWork([promise]);
    assert.equal(promise.semanticClass, "client_promises");
    assert.equal(projection?.stage, "waiting_external");
    assert.equal(projection?.ballHolder, "client");
    assert.equal(projection?.commitment?.date, "2026-10-07");
  });

  it("D: makes an external-promise follow-up founder-actionable only after the date passes", () => {
    const packet = {
      projection: {
        commitment: { actor: "client", date: "2026-10-07", window: null, deliverable: "send the pendant photo" },
      },
    } as never;
    assert.equal(isExternalPromiseFollowUpDue(packet, "2026-10-07T20:00:00Z"), false);
    assert.equal(isExternalPromiseFollowUpDue(packet, "2026-10-08T14:00:00Z"), true);
  });

  it("E: moves Abbey to founder review when the CAD arrives", () => {
    const delivered = sourceEvent({
      id: "abbey-cad",
      actor: "vendor_shop",
      direction: "inbound",
      text: "The revised CAD is attached.",
      attachments: ["NL-H017-Abbey-C026137-Mod2.jpg"],
    });
    const projection = projectCurrentWork([delivered]);
    assert.equal(projection?.stage, "cad_review");
    assert.equal(projection?.ballHolder, "founder");
  });

  it("F: keeps work waiting on the shop out of Founder", () => {
    const request = sourceEvent({
      id: "abbey-request",
      actor: "founder",
      direction: "outbound",
      text: "Please send the revised CAD.",
    });
    const projection = projectCurrentWork([request]);
    assert.equal(projection?.stage, "revision_requested");
    assert.equal(projection?.ballHolder, "vendor_shop");
  });
});
