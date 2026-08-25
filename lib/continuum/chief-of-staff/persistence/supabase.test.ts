import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { briefIdForLocalDate, stableAttentionId } from "../ids";
import type { AttentionItem, ChiefOfStaffBrief } from "../types";
import { OPEN_ATTENTION_STATUSES } from "./contract";
import { ChiefOfStaffPersistenceError } from "./errors";
import { briefToRow, itemToRow, rowToBrief, rowToItem } from "./map";
import { SupabaseChiefOfStaffStore } from "./supabase";

const NOW = "2026-08-25T15:00:00.000Z";
const LATER = "2026-08-25T16:00:00.000Z";
const PERSON = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";

type Row = Record<string, unknown>;

function sampleItem(overrides: Partial<AttentionItem> = {}): AttentionItem {
  const dedupeKey = overrides.dedupeKey ?? "founder-focus:one";
  return {
    id: overrides.id ?? stableAttentionId(dedupeKey),
    dedupeKey,
    kind: "founder-action",
    headline: "One founder action",
    whyItMatters: "It is founder-now.",
    recommendedAction: "Do the action.",
    urgency: "today",
    importance: "high",
    audience: "founder-action",
    confidence: "high",
    epistemicClass: "observed",
    observationIds: ["obs-opaque"],
    evidenceIds: ["ev-opaque"],
    status: "new",
    createdAt: NOW,
    reasonCodes: ["novel"],
    ...overrides,
  };
}

function sampleBrief(overrides: Partial<ChiefOfStaffBrief> = {}): ChiefOfStaffBrief {
  const localDate = overrides.localDate ?? "2026-08-25";
  return {
    id: briefIdForLocalDate(localDate),
    localDate,
    generatedAt: NOW,
    attentionItemIds: [],
    worthKnowing: [],
    silenceReason: "No material founder priorities require action today.",
    ...overrides,
  };
}

class FakeQuery {
  private filters: Array<{ col: string; op: "eq" | "in"; value: unknown }> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private payload: Row | null = null;
  private mode: "select" | "upsert" | "update" = "select";

  constructor(
    private readonly table: string,
    private readonly db: {
      items: Row[];
      briefs: Row[];
      entities: Row[];
      fail?: boolean;
    },
  ) {}

  select(_cols?: string) {
    this.mode = this.mode === "update" ? "update" : "select";
    return this;
  }

  upsert(row: Row) {
    this.mode = "upsert";
    this.payload = { ...row };
    return this;
  }

  update(row: Row) {
    this.mode = "update";
    this.payload = { ...row };
    return this;
  }

  eq(col: string, value: unknown) {
    this.filters.push({ col, op: "eq", value });
    return this;
  }

  in(col: string, value: unknown) {
    this.filters.push({ col, op: "in", value });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    return this.execute(true);
  }

  then<T>(
    resolve: (value: { data: unknown; error: { message: string } | null }) => T,
    reject?: (reason: unknown) => T,
  ) {
    return this.execute(false).then(resolve, reject);
  }

  private rows(): Row[] {
    if (this.table === "continuum_attention_items") return this.db.items;
    if (this.table === "continuum_attention_briefs") return this.db.briefs;
    return this.db.entities;
  }

  private matches(row: Row): boolean {
    return this.filters.every((filter) => {
      if (filter.op === "eq") return row[filter.col] === filter.value;
      const values = filter.value as unknown[];
      return values.includes(row[filter.col]);
    });
  }

  private async execute(single: boolean) {
    if (this.db.fail) {
      return { data: null, error: { message: "forced-failure" } };
    }
    if (this.mode === "upsert" && this.payload) {
      const table = this.rows();
      const key = this.table === "continuum_attention_briefs" ? "local_date" : "id";
      const idx = table.findIndex((row) => row[key] === this.payload![key]);
      if (idx >= 0) table[idx] = { ...table[idx], ...this.payload };
      else table.push({ ...this.payload });
      return { data: this.payload, error: null };
    }
    if (this.mode === "update" && this.payload) {
      const table = this.rows();
      const idx = table.findIndex((row) => this.matches(row));
      if (idx < 0) return { data: null, error: null };
      table[idx] = { ...table[idx], ...this.payload };
      return { data: single ? table[idx] : [table[idx]], error: null };
    }
    let found = this.rows().filter((row) => this.matches(row));
    if (this.orderCol) {
      const col = this.orderCol;
      const dir = this.orderAsc ? 1 : -1;
      found = [...found].sort((a, b) => {
        return String(a[col]).localeCompare(String(b[col])) * dir;
      });
    }
    if (this.limitCount != null) found = found.slice(0, this.limitCount);
    if (single) {
      return { data: found[0] ?? null, error: null };
    }
    return { data: found, error: null };
  }
}

function fakeClient(db: {
  items: Row[];
  briefs: Row[];
  entities: Row[];
  fail?: boolean;
}): SupabaseClient {
  return {
    from(table: string) {
      return new FakeQuery(table, db);
    },
  } as unknown as SupabaseClient;
}

describe("Chief of Staff Supabase mapping / store", () => {
  it("round-trips opaque text ids and sets updated_at on upsert", async () => {
    const db = { items: [] as Row[], briefs: [] as Row[], entities: [] as Row[] };
    const store = new SupabaseChiefOfStaffStore(fakeClient(db), () => LATER);
    const seed = sampleItem();
    const mapped = itemToRow(seed, LATER);
    assert.deepEqual(mapped.observation_ids, ["obs-opaque"]);
    assert.deepEqual(mapped.evidence_ids, ["ev-opaque"]);
    await store.upsertItems([seed]);
    assert.equal(db.items[0]?.updated_at, LATER);
    const loaded = await store.loadItem(seed.id);
    assert.equal(loaded?.headline, seed.headline);
    assert.deepEqual(loaded?.evidenceIds, ["ev-opaque"]);
    assert.equal(rowToItem(db.items[0]!).updatedAt, LATER);
  });

  it("upserts the same brief identity for one local date", async () => {
    const db = { items: [] as Row[], briefs: [] as Row[], entities: [] as Row[] };
    const store = new SupabaseChiefOfStaffStore(fakeClient(db), () => NOW);
    const first = sampleBrief({ attentionItemIds: ["A"] });
    await store.putBrief(first);
    const second = sampleBrief({
      generatedAt: LATER,
      attentionItemIds: ["A", "B"],
      worthKnowing: [{ headline: "Sarah's birthday is in 8 days." }],
      silenceReason: undefined,
    });
    await store.putBrief(second);
    assert.equal(db.briefs.length, 1);
    const loaded = await store.getBriefByLocalDate("2026-08-25");
    assert.equal(loaded?.id, briefIdForLocalDate("2026-08-25"));
    assert.deepEqual(loaded?.attentionItemIds, ["A", "B"]);
    assert.equal(
      loaded?.worthKnowing[0]?.headline,
      "Sarah's birthday is in 8 days.",
    );
    const roundTrip = rowToBrief(briefToRow(second, NOW));
    assert.deepEqual(roundTrip.attentionItemIds, ["A", "B"]);
  });

  it("loads open items by dedupe key using the open status set", async () => {
    const seed = sampleItem({ status: "snoozed", snoozedUntil: LATER });
    const db = {
      items: [itemToRow(seed, NOW)],
      briefs: [] as Row[],
      entities: [] as Row[],
    };
    const store = new SupabaseChiefOfStaffStore(fakeClient(db), () => NOW);
    assert.deepEqual([...OPEN_ATTENTION_STATUSES], [
      "new",
      "seen",
      "acknowledged",
      "snoozed",
    ]);
    const loaded = await store.loadOpenItemByDedupeKey(seed.dedupeKey);
    assert.equal(loaded?.id, seed.id);
  });

  it("updates lifecycle and writes updated_at", async () => {
    const seed = sampleItem();
    const db = {
      items: [itemToRow(seed, NOW)],
      briefs: [] as Row[],
      entities: [] as Row[],
    };
    const store = new SupabaseChiefOfStaffStore(fakeClient(db), () => LATER);
    const updated = await store.updateItemLifecycle(seed.id, {
      status: "acknowledged",
      acknowledgedAt: LATER,
    });
    assert.equal(updated.status, "acknowledged");
    assert.equal(updated.updatedAt, LATER);
    assert.equal(db.items[0]?.updated_at, LATER);
  });

  it("fails closed on entity kind mismatch and unknown ids", async () => {
    const db = {
      items: [] as Row[],
      briefs: [] as Row[],
      entities: [
        { id: PERSON, kind: "person" },
        { id: PROJECT, kind: "project" },
      ],
    };
    const store = new SupabaseChiefOfStaffStore(fakeClient(db), () => NOW);
    await store.upsertItems([sampleItem({ personId: PERSON })]);
    await assert.rejects(
      () => store.upsertItems([sampleItem({ personId: PROJECT })]),
      (error: unknown) =>
        error instanceof ChiefOfStaffPersistenceError &&
        error.code === "entity-kind-invalid",
    );
    await assert.rejects(
      () =>
        store.upsertItems([
          sampleItem({
            personId: "44444444-4444-4444-8444-444444444444",
          }),
        ]),
      (error: unknown) =>
        error instanceof ChiefOfStaffPersistenceError &&
        error.code === "entity-not-found",
    );
  });

  it("surfaces persistence failure as unavailable without a durable brief", async () => {
    const store = new SupabaseChiefOfStaffStore(
      fakeClient({ items: [], briefs: [], entities: [], fail: true }),
      () => NOW,
    );
    await assert.rejects(
      () => store.upsertItems([sampleItem()]),
      (error: unknown) =>
        error instanceof ChiefOfStaffPersistenceError &&
        error.code === "unavailable",
    );
  });
});
