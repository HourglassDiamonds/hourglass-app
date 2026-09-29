import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { before, describe, it } from "node:test";
import type { TodayGmailThreadContext } from "@/lib/continuum/candidates/founder-attention";
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

before(async () => {
  ({ loadLiveTodayOperationalFacts } = await import("./today-thread-context"));
});

describe("Today live Gmail rebuild batch", () => {
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
});
