import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { before, describe, it } from "node:test";
import {
  COS_DOCKET_TITLE,
  TODAY_DOCKET_VERSION,
  type CosTodayDocketView,
} from "./docket";
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
const LIVE = [1, ISO, ISO, 1, ISO, ISO, ISO, ISO, 1, ISO].join("|");

function emptyDocket(overrides: Partial<CosTodayDocketView> = {}): CosTodayDocketView {
  return {
    todayDocketVersion: TODAY_DOCKET_VERSION,
    title: COS_DOCKET_TITLE,
    items: [],
    queuedCount: 0,
    watchingCount: 0,
    watching: [],
    showCaughtUp: true,
    showDisconnected: false,
    caughtUpHeading: "You're caught up",
    caughtUpDetail: null,
    disconnectedHeading: null,
    disconnectedDetail: null,
    ...overrides,
  };
}

const payload: TodaySnapshotPayload = {
  readModelVersion: CONTINUUM_TODAY_READ_MODEL_VERSION,
  validUntil: null,
  docket: emptyDocket(),
};

type SnapshotRow = {
  snapshot_key: string;
  read_model_version: string;
  source_watermark: { token: string };
  payload: TodaySnapshotPayload;
  composed_at: string;
  updated_at: string;
};

function matchesSnapshot(
  row: SnapshotRow,
  filters: Array<{ column: string; value: string }>,
): boolean {
  return filters.every((filter) => {
    if (filter.column === "snapshot_key") return row.snapshot_key === filter.value;
    if (filter.column === "read_model_version") return row.read_model_version === filter.value;
    if (filter.column === "updated_at") return row.updated_at === filter.value;
    if (filter.column === "source_watermark->>token") {
      return row.source_watermark.token === filter.value;
    }
    return true;
  });
}

function createClient(input?: {
  row?: SnapshotRow | null;
  blindReads?: number;
  conflict?: "return" | "throw";
  onSnapshotRead?: (readNumber: number, row: SnapshotRow | null) => SnapshotRow | null;
  beforeUpdate?: (row: SnapshotRow | null, attempt: number) => void;
}) {
  let row = input?.row ?? null;
  let blindReads = input?.blindReads ?? 0;
  let snapshotReads = 0;
  let updates = 0;
  let updateAttempts = 0;
  const client = {
    from(table: string) {
      const query: {
        op: "select" | "insert" | "update";
        head: boolean;
        column: string;
        payload: SnapshotRow | null;
        filters: Array<{ column: string; value: string }>;
      } = {
        op: "select",
        head: false,
        column: "",
        payload: null,
        filters: [],
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
        eq(column: string, value: unknown) {
          query.filters.push({ column, value: String(value) });
          return api;
        },
        filter(column: string, _operator: string, value: unknown) {
          query.filters.push({ column, value: String(value) });
          return api;
        },
        lte() { return api; },
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
          updateAttempts += 1;
          input?.beforeUpdate?.(row, updateAttempts);
          if (!row || !query.payload || !matchesSnapshot(row, query.filters)) {
            return { data: [], error: null };
          }
          updates += 1;
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

const LEGACY_VERSION = "continuum-today-read-model-v1";

function legacyRow(updatedAt = ISO): SnapshotRow {
  return {
    snapshot_key: TODAY_SNAPSHOT_KEY,
    read_model_version: LEGACY_VERSION,
    source_watermark: { token: "legacy-watermark" },
    payload: {
      readModelVersion: LEGACY_VERSION,
      validUntil: null,
      docket: emptyDocket(),
    },
    composed_at: ISO,
    updated_at: updatedAt,
  };
}

const inquiryPayload: TodaySnapshotPayload = {
  readModelVersion: CONTINUUM_TODAY_READ_MODEL_VERSION,
  validUntil: null,
  docket: emptyDocket({ caughtUpHeading: "Atomic upgrade payload" }),
};

describe("today snapshot version upgrade", () => {
  it("upgrades an incompatible v1 row to the current model in place", async () => {
    const client = createClient({ row: legacyRow() });

    const result = await publishPersistedTodaySnapshot(client as never, {
      composedWatermark: LIVE,
      payload: inquiryPayload,
      composedAt: ISO,
    });

    assert.equal(result, "published");
    assert.equal(client.updateCount(), 1);
    assert.equal(client.current()?.snapshot_key, TODAY_SNAPSHOT_KEY);
    assert.equal(client.current()?.read_model_version, CONTINUUM_TODAY_READ_MODEL_VERSION);
    assert.equal(client.current()?.source_watermark.token, LIVE);
    assert.equal(client.current()?.payload.docket.caughtUpHeading, "Atomic upgrade payload");
    assert.equal(client.current()?.payload.docket.showCaughtUp, true);
  });

  it("reuses a persisted current-model snapshot for the same watermark", async () => {
    const client = createClient({ row: seeded(LIVE) });

    const result = await publishPersistedTodaySnapshot(client as never, {
      composedWatermark: LIVE,
      payload,
      composedAt: ISO,
    });

    assert.equal(result, "published");
    assert.equal(client.current()?.read_model_version, CONTINUUM_TODAY_READ_MODEL_VERSION);
    assert.equal(client.current()?.source_watermark.token, LIVE);
  });

  it("lets the losing simultaneous upgrade keep the valid current-model winner", async () => {
    const winner = seeded(LIVE);
    winner.updated_at = "winner-time";
    const client = createClient({
      row: legacyRow(),
      beforeUpdate(row) {
        if (!row || row.read_model_version !== LEGACY_VERSION) return;
        Object.assign(row, winner);
      },
    });

    const result = await publishPersistedTodaySnapshot(client as never, {
      composedWatermark: LIVE,
      payload: inquiryPayload,
      composedAt: ISO,
    });

    assert.equal(result, "published");
    assert.equal(client.updateCount(), 0);
    assert.equal(client.current()?.read_model_version, CONTINUUM_TODAY_READ_MODEL_VERSION);
    assert.equal(client.current()?.updated_at, "winner-time");
    assert.equal(client.current()?.payload.docket.caughtUpHeading, "You're caught up");
  });

  it("does not overwrite a newer current-model snapshot that won the upgrade race", async () => {
    const newer = seeded("newer-than-live");
    newer.updated_at = "newer-time";
    const client = createClient({
      row: legacyRow(),
      beforeUpdate(row) {
        if (!row || row.read_model_version !== LEGACY_VERSION) return;
        Object.assign(row, newer);
      },
    });

    const result = await publishPersistedTodaySnapshot(client as never, {
      composedWatermark: LIVE,
      payload: inquiryPayload,
      composedAt: ISO,
    });

    assert.equal(result, "published");
    assert.equal(client.updateCount(), 0);
    assert.equal(client.current()?.source_watermark.token, "newer-than-live");
    assert.equal(client.current()?.read_model_version, CONTINUUM_TODAY_READ_MODEL_VERSION);
  });

  it("retries one incompatible compare-and-swap miss and then upgrades", async () => {
    const client = createClient({
      row: legacyRow(),
      beforeUpdate(row, attempt) {
        if (attempt === 1 && row?.read_model_version === LEGACY_VERSION) {
          row.updated_at = "moved";
        }
      },
    });

    const result = await publishPersistedTodaySnapshot(client as never, {
      composedWatermark: LIVE,
      payload,
      composedAt: ISO,
    });

    assert.equal(result, "published");
    assert.equal(client.updateCount(), 1);
    assert.equal(client.current()?.read_model_version, CONTINUUM_TODAY_READ_MODEL_VERSION);
  });

  it("inserts the first snapshot when no row exists", async () => {
    const client = createClient();

    const result = await publishPersistedTodaySnapshot(client as never, {
      composedWatermark: LIVE,
      payload: inquiryPayload,
      composedAt: ISO,
    });

    assert.equal(result, "published");
    assert.equal(client.updateCount(), 0);
    assert.equal(client.current()?.read_model_version, CONTINUUM_TODAY_READ_MODEL_VERSION);
    assert.equal(client.current()?.payload.docket.caughtUpHeading, "Atomic upgrade payload");
  });

  it("does not accept a 23505 winner that is still an old read model", async () => {
    const client = createClient({
      row: legacyRow(),
      blindReads: 1,
      conflict: "return",
    });

    const result = await publishPersistedTodaySnapshot(client as never, {
      composedWatermark: LIVE,
      payload,
      composedAt: ISO,
    });

    assert.equal(result, "published");
    assert.equal(client.current()?.read_model_version, CONTINUUM_TODAY_READ_MODEL_VERSION);
    assert.notEqual(client.current()?.read_model_version, LEGACY_VERSION);
  });

  it("does not let a background publish downgrade the current model to v1", async () => {
    const client = createClient({ row: seeded(LIVE) });
    const downgrade = {
      ...payload,
      readModelVersion: LEGACY_VERSION,
    } as TodaySnapshotPayload;

    const result = await publishPersistedTodaySnapshot(client as never, {
      composedWatermark: LIVE,
      payload: downgrade,
      composedAt: ISO,
    });

    assert.equal(result, "unavailable");
    assert.equal(client.updateCount(), 0);
    assert.equal(client.current()?.read_model_version, CONTINUUM_TODAY_READ_MODEL_VERSION);
  });
});
