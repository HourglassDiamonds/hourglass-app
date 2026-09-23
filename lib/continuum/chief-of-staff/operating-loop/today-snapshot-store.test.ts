import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { before, describe, it } from "node:test";
import {
  CONTINUUM_TODAY_READ_MODEL_VERSION,
  TODAY_SNAPSHOT_KEY,
  type TodaySnapshotPayload,
} from "@/lib/continuum/today-snapshot";

const require = createRequire(import.meta.url);
const nodeModule = require("module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = nodeModule._load;
nodeModule._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

let publishPersistedTodaySnapshot: typeof import("@/lib/continuum/today-snapshot-store").publishPersistedTodaySnapshot;

before(async () => {
  ({ publishPersistedTodaySnapshot } = await import("@/lib/continuum/today-snapshot-store"));
});

const ISO = "2026-09-23T00:00:00.000Z";
const LIVE = [1, ISO, ISO, 1, ISO, ISO, ISO].join("|");

const payload = {
  readModelVersion: CONTINUUM_TODAY_READ_MODEL_VERSION,
  docket: { items: [], watching: [] },
} as TodaySnapshotPayload;

type SnapshotRow = {
  snapshot_key: string;
  read_model_version: string;
  source_watermark: { token: string };
  payload: TodaySnapshotPayload;
  composed_at: string;
  updated_at: string;
};

function createClient(input?: {
  row?: SnapshotRow | null;
  blindReads?: number;
  conflict?: "return" | "throw";
  onSnapshotRead?: (readNumber: number, row: SnapshotRow | null) => SnapshotRow | null;
}) {
  let row = input?.row ?? null;
  let blindReads = input?.blindReads ?? 0;
  let snapshotReads = 0;
  let updates = 0;
  const client = {
    from(table: string) {
      const query: {
        op: "select" | "insert" | "update";
        head: boolean;
        column: string;
        payload: SnapshotRow | null;
        token: string | null;
      } = {
        op: "select",
        head: false,
        column: "",
        payload: null,
        token: null,
      };
      const api = {
        select(column?: string, options?: { head?: boolean }) {
          query.column = typeof column === "string" ? column : "";
          query.head = Boolean(options?.head);
          return api;
        },
        insert(next: SnapshotRow) {
          query.op = "insert";
          query.payload = next;
          return api;
        },
        update(next: SnapshotRow) {
          query.op = "update";
          query.payload = next;
          return api;
        },
        eq() {
          return api;
        },
        filter(_column: string, _operator: string, token: string) {
          query.token = token;
          return api;
        },
        order() {
          return api;
        },
        limit() {
          return api;
        },
        then(
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (error: unknown) => unknown,
        ) {
          try {
            return Promise.resolve(execute()).then(onFulfilled, onRejected);
          } catch (error) {
            return Promise.reject(error).then(onFulfilled, onRejected);
          }
        },
      };

      function execute() {
        if (table !== "continuum_today_snapshots") {
          if (query.head) return { count: 1, error: null, data: null };
          return { data: [{ [query.column]: ISO }], error: null };
        }
        if (query.op === "insert") {
          const error = { code: "23505" };
          if (input?.conflict === "throw") throw error;
          if (input?.conflict === "return") return { data: null, error };
          if (row) return { data: null, error };
          row = query.payload;
          return { data: [{ snapshot_key: TODAY_SNAPSHOT_KEY }], error: null };
        }
        if (query.op === "update") {
          updates += 1;
          if (!row || row.source_watermark.token !== query.token || !query.payload) {
            return { data: [], error: null };
          }
          row = query.payload;
          return { data: [{ snapshot_key: TODAY_SNAPSHOT_KEY }], error: null };
        }
        snapshotReads += 1;
        if (blindReads > 0) {
          blindReads -= 1;
          return { data: [], error: null };
        }
        row = input?.onSnapshotRead?.(snapshotReads, row) ?? row;
        return { data: row ? [row] : [], error: null };
      }

      return api;
    },
    current() {
      return row;
    },
    updateCount() {
      return updates;
    },
  };
  return client;
}

function seeded(token: string): SnapshotRow {
  return {
    snapshot_key: TODAY_SNAPSHOT_KEY,
    read_model_version: CONTINUUM_TODAY_READ_MODEL_VERSION,
    source_watermark: { token },
    payload,
    composed_at: ISO,
    updated_at: ISO,
  };
}

describe("today snapshot first-seed race", () => {
  it("keeps the winning row when a second first insert hits 23505", async () => {
    const client = createClient({
      row: seeded(LIVE),
      blindReads: 1,
      conflict: "return",
    });

    const result = await publishPersistedTodaySnapshot(client as never, {
      composedWatermark: LIVE,
      payload,
      composedAt: ISO,
    });

    assert.equal(result, "published");
    assert.equal(client.updateCount(), 0);
    assert.equal(client.current()?.source_watermark.token, LIVE);
    assert.equal(client.current()?.read_model_version, CONTINUUM_TODAY_READ_MODEL_VERSION);
  });

  it("does not fail the publisher when the unique violation is thrown", async () => {
    const client = createClient({
      row: seeded(LIVE),
      blindReads: 1,
      conflict: "throw",
    });

    await assert.doesNotReject(() =>
      publishPersistedTodaySnapshot(client as never, {
        composedWatermark: LIVE,
        payload,
        composedAt: ISO,
      }),
    );
    assert.equal(client.current()?.source_watermark.token, LIVE);
  });

  it("publishes over a stale first-seed winner only through the watermark guard", async () => {
    const client = createClient({
      row: seeded("stale-winner"),
      blindReads: 1,
      conflict: "return",
    });

    const result = await publishPersistedTodaySnapshot(client as never, {
      composedWatermark: LIVE,
      payload,
      composedAt: ISO,
    });

    assert.equal(result, "published");
    assert.equal(client.updateCount(), 1);
    assert.equal(client.current()?.source_watermark.token, LIVE);
  });

  it("does not let an older compose overwrite the current snapshot", async () => {
    const client = createClient({ row: seeded(LIVE) });

    const result = await publishPersistedTodaySnapshot(client as never, {
      composedWatermark: "older-watermark",
      payload,
      composedAt: ISO,
    });

    assert.equal(result, "stale");
    assert.equal(client.updateCount(), 0);
    assert.equal(client.current()?.source_watermark.token, LIVE);
  });

  it("does not let a late first-seed writer replace a newer watermark", async () => {
    const client = createClient({
      row: seeded("stale-winner"),
      blindReads: 1,
      conflict: "return",
      onSnapshotRead(readNumber, row) {
        if (readNumber === 3 && row) {
          return seeded("newer-b");
        }
        return row;
      },
    });

    const result = await publishPersistedTodaySnapshot(client as never, {
      composedWatermark: LIVE,
      payload,
      composedAt: ISO,
    });

    assert.equal(result, "lost-race");
    assert.equal(client.updateCount(), 0);
    assert.equal(client.current()?.source_watermark.token, "newer-b");
  });
});
