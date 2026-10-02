import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { before, describe, it } from "node:test";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import type { LiveSourceViewerBatch } from "./source-viewer-run";

const require = createRequire(import.meta.url);
const nodeModule = require("module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = nodeModule._load;
nodeModule._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

let loadLiveTodayOperationalFacts: typeof import("./today-thread-context").loadLiveTodayOperationalFacts;
let loadIndexedTodayThreadContext: typeof import("./today-thread-context").loadIndexedTodayThreadContext;

before(async () => {
  ({ loadIndexedTodayThreadContext, loadLiveTodayOperationalFacts } = await import("./today-thread-context"));
});

function candidate(
  id: string,
  threadId: string,
  messageId: string,
): ContinuumCandidate {
  return {
    candidateId: id,
    sourceSystem: "gmail",
    sourceRef: `gc1|${threadId}|${messageId}`,
    sourceTimestamp: "2026-09-22T22:00:00.000Z",
    candidateType: "note",
    proposedTarget: { kind: "none" },
    payload: { kind: "note", text: id, contextLayer: null },
    confidence: "high",
    evidenceBasis: { ruleIds: ["test"], matchedText: id },
    candidateState: "active",
    reviewStatus: "pending",
    lastReviewAction: null,
    founderEditedPayload: null,
    founderEditedTarget: null,
    reviewedAt: null,
    createdAt: "2026-09-22T22:00:00.000Z",
    canonical: false,
    automaticApply: false,
    parserVersion: "test",
    supersedesCandidateId: null,
    supersededByCandidateId: null,
  };
}

function pagedClient(
  messages: readonly Record<string, unknown>[],
  attachments: readonly Record<string, unknown>[],
) {
  return {
    from(table: string) {
      const rows = table === "continuum_gmail_attachments" ? attachments : messages;
      let filterColumn = "";
      let filterValues: readonly string[] = [];
      const query = {
        select() {
          return query;
        },
        in(column: string, values: readonly string[]) {
          filterColumn = column;
          filterValues = values;
          return query;
        },
        order() {
          return query;
        },
        async range(from: number, to: number) {
          const filtered = rows.filter((row) =>
            filterValues.includes(String(row[filterColumn] ?? "")),
          );
          return { data: filtered.slice(from, to + 1), error: null };
        },
        then(
          resolve: (value: { data: readonly Record<string, unknown>[]; error: null }) => unknown,
        ) {
          const filtered = rows.filter((row) =>
            filterValues.includes(String(row[filterColumn] ?? "")),
          );
          return Promise.resolve(resolve({ data: filtered, error: null }));
        },
      };
      return query;
    },
  };
}

describe("Today live Gmail rebuild batch", () => {
  it("pages indexed evidence so Sarah and Tim survive the 1,000-row response boundary", async () => {
    const fillerThread = "aaaaaaaaaa";
    const sarahThread = "bbbbbbbbbb";
    const timThread = "cccccccccc";
    const fillerMessages = Array.from({ length: 1_000 }, (_, index) => ({
      thread_id: fillerThread,
      message_id: `filler-${index}`,
      sent_at: `2026-09-23T${String(index % 24).padStart(2, "0")}:00:00.000Z`,
      direction: "inbound",
      subject: "Filler",
      label_ids: [],
      from_email_hash: "filler-hash",
      has_attachments: true,
    }));
    const messages = [
      ...fillerMessages,
      {
        thread_id: sarahThread,
        message_id: "sarah-message",
        sent_at: "2026-09-22T22:00:00.000Z",
        direction: "inbound",
        subject: "RE: HGD x Sarah-C026143",
        label_ids: [],
        from_email_hash: "sarah-hash",
        has_attachments: true,
      },
      {
        thread_id: timThread,
        message_id: "tim-message",
        sent_at: "2026-09-22T21:00:00.000Z",
        direction: "outbound",
        subject: "RE: HGD x Tim/Jenn-C025964",
        label_ids: [],
        from_email_hash: "founder-hash",
        has_attachments: true,
      },
    ];
    const attachments = [
      ...Array.from({ length: 1_000 }, (_, index) => ({
        thread_id: fillerThread,
        message_id: `filler-${index}`,
        filename: `filler-${index}.pdf`,
      })),
      {
        thread_id: sarahThread,
        message_id: "sarah-message",
        filename: "Sarah-C026143-CAD.pdf",
      },
      {
        thread_id: timThread,
        message_id: "tim-message",
        filename: "Tim-Jenn-C025964-order.pdf",
      },
    ];
    const candidates = [
      candidate("filler", fillerThread, "filler-0"),
      candidate("sarah", sarahThread, "sarah-message"),
      candidate("tim", timThread, "tim-message"),
    ];

    const result = await loadIndexedTodayThreadContext(candidates, {
      client: pagedClient(messages, attachments) as never,
    });

    assert.equal(result.get(sarahThread)?.messages?.[0]?.messageId, "sarah-message");
    assert.deepEqual(result.get(sarahThread)?.attachmentFilenames, ["Sarah-C026143-CAD.pdf"]);
    assert.equal(result.get(timThread)?.messages?.[0]?.messageId, "tim-message");
    assert.deepEqual(result.get(timThread)?.attachmentFilenames, ["Tim-Jenn-C025964-order.pdf"]);
  });

  it("loads one credential context and reads each stable thread once", async () => {
    const base = new Map<string, TodayGmailThreadContext>([
      [
        "thread-a",
        {
          messages: [
            {
              messageId: "message-a",
              sentAt: "2026-09-29T12:00:00.000Z",
              direction: "inbound",
            },
          ],
        },
      ],
      [
        "thread-b",
        {
          messages: [
            {
              messageId: "message-b",
              sentAt: "2026-09-29T13:00:00.000Z",
              direction: "inbound",
            },
          ],
        },
      ],
    ]);
    let credentialLoads = 0;
    const reads = new Map<string, number>();
    const createBatch = async (): Promise<LiveSourceViewerBatch> => {
      credentialLoads += 1;
      return {
        credentialLoads: 1,
        metrics: { threadFetches: 0 },
        async fetchThread({ threadId, indexed }) {
          reads.set(threadId, (reads.get(threadId) ?? 0) + 1);
          return {
            ok: true,
            safeErrorCode: null,
            threadId,
            indexedSubject: null,
            messages: indexed.map((message) => ({
              messageId: message.messageId,
              threadId,
              sentAt: message.sentAt,
              fromRaw: "Shop <shop@example.test>",
              fromEmail: "shop@example.test",
              to: [],
              cc: [],
              subject: message.subject,
              plainText: "CAD attached. Production has started.",
              snippet: "",
              attachments: [],
            })),
            gmailMutation: false,
            plaintextPersisted: false,
            cursorUnchanged: true,
            readOnly: true,
          };
        },
      };
    };

    const enriched = await loadLiveTodayOperationalFacts(base, { createBatch });
    assert.equal(credentialLoads, 1);
    assert.deepEqual([...reads.entries()].sort(), [
      ["thread-a", 1],
      ["thread-b", 1],
    ]);
    assert.match(
      enriched.get("thread-a")?.messages?.[0]?.operationalText ?? "",
      /Production has started/,
    );
  });

  it("keeps indexed local evidence when live enrichment is unavailable", async () => {
    const base = new Map<string, TodayGmailThreadContext>([
      ["thread-a", { subject: "Indexed subject", messages: [] }],
    ]);
    const result = await loadLiveTodayOperationalFacts(base, {
      createBatch: async () => null,
    });
    assert.equal(result.get("thread-a")?.subject, "Indexed subject");
  });

  it("rejects a partial live batch when completeness is required for publication", async () => {
    const base = new Map<string, TodayGmailThreadContext>([
      [
        "thread-a",
        {
          subject: "Indexed A",
          messages: [
            {
              messageId: "message-a",
              sentAt: "2026-09-22T20:00:00.000Z",
              direction: "inbound",
              labelIds: [],
              fromEmailHash: null,
              subject: "Indexed A",
              hasAttachments: false,
            },
          ],
        },
      ],
      [
        "thread-b",
        {
          subject: "Nathan / C026176",
          messages: [
            {
              messageId: "message-b",
              sentAt: "2026-09-22T21:00:00.000Z",
              direction: "outbound",
              labelIds: [],
              fromEmailHash: null,
              subject: "Nathan / C026176",
              hasAttachments: true,
            },
          ],
        },
      ],
    ]);

    await assert.rejects(
      () =>
        loadLiveTodayOperationalFacts(base, {
          requireComplete: true,
          createBatch: async () => ({
            async fetchThread({ threadId }) {
              if (threadId === "thread-b") {
                return { ok: false, reason: "unavailable" } as never;
              }
              return {
                ok: true,
                indexedSubject: "Indexed A",
                messages: [
                  {
                    messageId: "message-a",
                    threadId: "thread-a",
                    sentAt: "2026-09-22T20:00:00.000Z",
                    fromRaw: "Shop <shop@example.test>",
                    fromEmail: "shop@example.test",
                    to: [],
                    cc: [],
                    subject: "Indexed A",
                    plainText: "CAD attached.",
                    snippet: "",
                    attachments: [],
                  },
                ],
                gmailMutation: false,
                plaintextPersisted: false,
                cursorUnchanged: true,
                readOnly: true,
              };
            },
          }),
        }),
      /today-live-enrichment-incomplete/,
    );
  });
});
