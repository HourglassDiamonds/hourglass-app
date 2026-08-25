import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { briefIdForLocalDate, stableAttentionId } from "../ids";
import type { AttentionItem, ChiefOfStaffBrief } from "../types";
import { InMemoryChiefOfStaffStore } from "./memory";
import { ChiefOfStaffPersistenceError } from "./errors";
import type { EntityKindReader } from "./contract";

const NOW = "2026-08-25T15:00:00.000Z";
const LATER = "2026-08-25T16:00:00.000Z";
const PERSON = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const UNKNOWN = "33333333-3333-4333-8333-333333333333";

function item(overrides: Partial<AttentionItem> = {}): AttentionItem {
  const dedupeKey = overrides.dedupeKey ?? "founder-focus:sprint-charlotte-editorial";
  return {
    id: overrides.id ?? stableAttentionId(dedupeKey),
    dedupeKey,
    kind: "founder-action",
    headline: "Follow up with Charlotte editorial contact today",
    whyItMatters: "Third-party Charlotte authority remains the highest-leverage GEO gap.",
    recommendedAction: "Follow up with Charlotte editorial contact today",
    urgency: "today",
    importance: "high",
    audience: "founder-action",
    confidence: "high",
    epistemicClass: "observed",
    observationIds: ["obs-not-a-uuid"],
    evidenceIds: ["ev-follow-up"],
    status: "new",
    createdAt: NOW,
    reasonCodes: ["novel", "founder-focus"],
    ...overrides,
  };
}

function brief(overrides: Partial<ChiefOfStaffBrief> = {}): ChiefOfStaffBrief {
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

function kinds(map: Record<string, "person" | "project" | "other">): EntityKindReader {
  return {
    async getKind(id) {
      return map[id] ?? null;
    },
  };
}

describe("Chief of Staff in-memory store", () => {
  it("upserts attention items and reloads by id and ordered ids", async () => {
    const store = new InMemoryChiefOfStaffStore({ nowIso: () => NOW });
    const a = item({ id: "A", dedupeKey: "a", headline: "A" });
    const b = item({ id: "B", dedupeKey: "b", headline: "B" });
    await store.upsertItems([a, b]);
    const loaded = await store.loadItemsByIds(["B", "A"]);
    assert.deepEqual(
      loaded.map((row) => row.id),
      ["B", "A"],
    );
    assert.equal((await store.loadItem("A"))?.updatedAt, NOW);
  });

  it("keeps opaque observation and evidence ids that are not UUIDs", async () => {
    const store = new InMemoryChiefOfStaffStore({ nowIso: () => NOW });
    const row = item();
    await store.upsertItems([row]);
    const loaded = await store.loadItem(row.id);
    assert.deepEqual(loaded?.observationIds, ["obs-not-a-uuid"]);
    assert.deepEqual(loaded?.evidenceIds, ["ev-follow-up"]);
  });

  it("loads the open row by dedupe key and ignores resolved history", async () => {
    const store = new InMemoryChiefOfStaffStore({ nowIso: () => NOW });
    const key = "founder-focus:same";
    const resolved = item({
      id: "old",
      dedupeKey: key,
      status: "resolved",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const open = item({ id: "new", dedupeKey: key, status: "acknowledged" });
    await store.upsertItems([resolved, open]);
    const loaded = await store.loadOpenItemByDedupeKey(key);
    assert.equal(loaded?.id, "new");
    assert.equal((await store.loadItemByDedupeKey(key))?.id, "new");
  });

  it("reopens the same stable id through lifecycle update and upsert", async () => {
    const store = new InMemoryChiefOfStaffStore({
      nowIso: () => LATER,
    });
    const seed = item({ status: "acknowledged", acknowledgedAt: NOW });
    await store.upsertItems([{ ...seed, updatedAt: NOW }]);
    const reopened = await store.updateItemLifecycle(seed.id, {
      status: "new",
      acknowledgedAt: "",
    });
    assert.equal(reopened.id, seed.id);
    assert.equal(reopened.status, "new");
    assert.equal(reopened.updatedAt, LATER);
    await store.upsertItems([
      { ...seed, status: "new", reasonCodes: ["worsened"] },
    ]);
    assert.equal((await store.loadItem(seed.id))?.id, seed.id);
    assert.equal((await store.loadOpenItemByDedupeKey(seed.dedupeKey))?.id, seed.id);
  });

  it("upserts one brief per local date and preserves snapshot order", async () => {
    const store = new InMemoryChiefOfStaffStore({ nowIso: () => NOW });
    const first = brief({
      attentionItemIds: ["A", "B"],
      silenceReason: undefined,
      worthKnowing: [{ headline: "Sarah's birthday is in 8 days." }],
    });
    await store.putBrief(first);
    const second = brief({
      generatedAt: LATER,
      attentionItemIds: ["A", "B", "C"],
      worthKnowing: [{ headline: "Sarah's birthday is in 8 days." }],
    });
    await store.putBrief(second);
    const loaded = await store.getBriefByLocalDate("2026-08-25");
    assert.equal(loaded?.id, first.id);
    assert.deepEqual(loaded?.attentionItemIds, ["A", "B", "C"]);
    assert.equal(loaded?.generatedAt, LATER);
    assert.equal(loaded?.worthKnowing[0]?.headline, "Sarah's birthday is in 8 days.");
  });

  it("accepts matching Person and Project entity kinds", async () => {
    const store = new InMemoryChiefOfStaffStore({
      nowIso: () => NOW,
      entities: kinds({ [PERSON]: "person", [PROJECT]: "project" }),
    });
    await store.upsertItems([
      item({ personId: PERSON, projectId: PROJECT }),
    ]);
    assert.equal((await store.loadItem(item().id))?.personId, PERSON);
  });

  it("fails closed when personId is a project or unknown", async () => {
    const store = new InMemoryChiefOfStaffStore({
      nowIso: () => NOW,
      entities: kinds({ [PERSON]: "person", [PROJECT]: "project" }),
    });
    await assert.rejects(
      () => store.upsertItems([item({ personId: PROJECT })]),
      (error: unknown) =>
        error instanceof ChiefOfStaffPersistenceError &&
        error.code === "entity-kind-invalid",
    );
    await assert.rejects(
      () => store.upsertItems([item({ projectId: PERSON })]),
      (error: unknown) =>
        error instanceof ChiefOfStaffPersistenceError &&
        error.code === "entity-kind-invalid",
    );
    await assert.rejects(
      () => store.upsertItems([item({ personId: UNKNOWN })]),
      (error: unknown) =>
        error instanceof ChiefOfStaffPersistenceError &&
        error.code === "entity-not-found",
    );
  });
});
