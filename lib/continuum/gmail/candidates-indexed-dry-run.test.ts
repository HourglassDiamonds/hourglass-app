import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryGmailIndexStore } from "../client-memory/gmail/store";
import {
  EIGHT_PROJECT_IDS,
  EIGHT_PROJECT_WORLD,
  EIGHT_THREADS,
} from "./candidates/fixtures";
import {
  INDEX_LIMITATION_BODY_TEXT_NOT_AVAILABLE,
  INDEX_ONLY_BODY_DEPENDENT_PARSER_RULES,
  INDEXED_EIGHT_KNOWN_MESSAGE_IDS,
  INDEXED_EIGHT_PROJECT_KEYS,
  presentIndexedEightProjectAcceptance,
  presentIndexedGmailCandidateDryRun,
} from "./candidates/indexed-dry-run";
import { CANDIDATE_MUTATION_BOUNDARY } from "@/lib/continuum/candidates";

const NOW = "2026-09-07T12:00:00.000Z";

describe("indexed Gmail candidate dry-run (in-memory fixture, not real #16B)", () => {
  it("proposes from index metadata only and does not invent Open Jobs from attachments", async () => {
    const index = new InMemoryGmailIndexStore();
    await index.indexMessage(
      {
        messageId: INDEXED_EIGHT_KNOWN_MESSAGE_IDS.pennock,
        threadId: EIGHT_THREADS.pennock,
        sentAt: "2026-08-20T15:00:00.000Z",
        subject: "Pennock",
        fromEmail: "pennock.client@example.test",
        direction: "inbound",
        hasAttachments: false,
      },
      NOW,
    );
    await index.indexMessage(
      {
        messageId: INDEXED_EIGHT_KNOWN_MESSAGE_IDS.leeSpiegel,
        threadId: EIGHT_THREADS.leeSpiegel,
        sentAt: "2026-08-21T16:00:00.000Z",
        subject: "CAD presentation",
        fromEmail: "lee.spiegel@example.test",
        direction: "inbound",
        hasAttachments: true,
      },
      NOW,
    );
    await index.indexMessage(
      {
        messageId: INDEXED_EIGHT_KNOWN_MESSAGE_IDS.travis,
        threadId: EIGHT_THREADS.travis,
        sentAt: "2026-08-22T17:00:00.000Z",
        subject: "Size",
        fromEmail: "travis.client@example.test",
        direction: "inbound",
      },
      NOW,
    );
    await index.indexMessage(
      {
        messageId: INDEXED_EIGHT_KNOWN_MESSAGE_IDS.travisVendor,
        threadId: EIGHT_THREADS.travis,
        sentAt: "2026-08-23T18:00:00.000Z",
        subject: "Production",
        fromEmail: "travis.vendor@example.test",
        direction: "inbound",
      },
      NOW,
    );
    await index.indexMessage(
      {
        messageId: INDEXED_EIGHT_KNOWN_MESSAGE_IDS.sarah,
        threadId: EIGHT_THREADS.sarah,
        sentAt: "2026-08-24T19:00:00.000Z",
        subject: "CAD 563876",
        fromEmail: "sarah.client@example.test",
        direction: "inbound",
      },
      NOW,
    );
    await index.indexMessage(
      {
        messageId: INDEXED_EIGHT_KNOWN_MESSAGE_IDS.sarahQuote,
        threadId: EIGHT_THREADS.sarah,
        sentAt: "2026-08-24T20:00:00.000Z",
        subject: "Quote",
        fromEmail: "sarah.client@example.test",
        direction: "inbound",
      },
      NOW,
    );
    await index.indexMessage(
      {
        messageId: INDEXED_EIGHT_KNOWN_MESSAGE_IDS.chelsea,
        threadId: EIGHT_THREADS.chelsea,
        sentAt: "2026-08-26T21:00:00.000Z",
        subject: "CR5001024",
        fromEmail: "chelsea.client@example.test",
        direction: "inbound",
      },
      NOW,
    );
    await index.indexMessage(
      {
        messageId: "d1d1d1d1d1d1d1d1",
        threadId: EIGHT_THREADS.dylan,
        sentAt: "2026-08-25T20:00:00.000Z",
        subject: "Looks good",
        fromEmail: "dylan.client@example.test",
        direction: "inbound",
      },
      NOW,
    );
    await index.indexMessage(
      {
        messageId: "e2e2e2e2e2e2e2e2",
        threadId: EIGHT_THREADS.madi,
        sentAt: "2026-08-27T22:00:00.000Z",
        subject: "C017756",
        fromEmail: "madi.client@example.test",
        direction: "inbound",
      },
      NOW,
    );
    await index.indexMessage(
      {
        messageId: "f3f3f3f3f3f3f3f3",
        threadId: EIGHT_THREADS.kaitlin,
        sentAt: "2026-08-28T23:00:00.000Z",
        subject: "C017755",
        fromEmail: "kaitlin.client@example.test",
        direction: "inbound",
      },
      NOW,
    );

    const known = Object.values(INDEXED_EIGHT_KNOWN_MESSAGE_IDS);
    const messages = [
      ...(await Promise.all(known.map((id) => index.getMessage(id)))),
      await index.getMessage("d1d1d1d1d1d1d1d1"),
      await index.getMessage("e2e2e2e2e2e2e2e2"),
      await index.getMessage("f3f3f3f3f3f3f3f3"),
    ];
    const dryRun = presentIndexedGmailCandidateDryRun({
      messages,
      knownMessageIds: known,
      world: EIGHT_PROJECT_WORLD,
      createdAt: NOW,
    });

    assert.equal(dryRun.liveModelCalls, false);
    assert.equal(dryRun.gmailFetch, false);
    assert.equal(dryRun.plaintextUsed, false);
    assert.deepEqual(dryRun.mutationBoundary, CANDIDATE_MUTATION_BOUNDARY);
    assert.ok(dryRun.rows.every((row) => row.presentInIndex));
    assert.ok(dryRun.rows.every((row) => row.plaintextAvailable === false));
    assert.ok(
      dryRun.candidates.some(
        (row) =>
          row.candidateType === "project_association" &&
          row.proposedTarget.kind === "project" &&
          row.proposedTarget.projectId === EIGHT_PROJECT_IDS.pennock,
      ),
    );
    assert.equal(
      dryRun.candidates.some(
        (row) =>
          row.payload.kind === "structured_spec" &&
          /platinum/i.test(row.payload.proposedValue),
      ),
      false,
    );
    assert.equal(
      dryRun.candidates.some(
        (row) =>
          row.payload.kind === "structured_spec" &&
          row.payload.fieldName === "finger_size" &&
          row.payload.proposedValue === "12.5",
      ),
      false,
    );
    const lee = dryRun.rows.find(
      (row) => row.messageId === INDEXED_EIGHT_KNOWN_MESSAGE_IDS.leeSpiegel,
    );
    assert.ok(lee);
    assert.equal(lee?.openJobCandidates.length, 0);
    assert.ok(lee?.candidateTypes.includes("project_association"));
    const chelsea = dryRun.rows.find(
      (row) => row.messageId === INDEXED_EIGHT_KNOWN_MESSAGE_IDS.chelsea,
    );
    assert.ok(chelsea?.candidateTypes.includes("project_association"));
    assert.ok(INDEX_ONLY_BODY_DEPENDENT_PARSER_RULES.includes("explicit_metal"));

    const acceptance = presentIndexedEightProjectAcceptance({
      world: EIGHT_PROJECT_WORLD,
      messages: messages.filter((row): row is NonNullable<typeof row> => Boolean(row)),
      projectIdsByKey: EIGHT_PROJECT_IDS,
      extraMessageIdsByKey: {
        dylan: ["d1d1d1d1d1d1d1d1"],
        madi: ["e2e2e2e2e2e2e2e2"],
        kaitlin: ["f3f3f3f3f3f3f3f3"],
      },
      createdAt: NOW,
    });
    assert.deepEqual(
      acceptance.projects.map((row) => row.projectKey),
      [...INDEXED_EIGHT_PROJECT_KEYS],
    );
    const pennock = acceptance.projects.find((row) => row.projectKey === "pennock");
    assert.ok(pennock);
    assert.ok(pennock?.indexedEvidence.length);
    assert.ok(
      pennock?.notEmittedBecauseIndexLacksContent.some(
        (row) =>
          row.expected.includes("platinum") &&
          row.reason === INDEX_LIMITATION_BODY_TEXT_NOT_AVAILABLE,
      ),
    );
    assert.equal(acceptance.plaintextUsed, false);
    assert.equal(acceptance.gmailFetch, false);
  });
});
