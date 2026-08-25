import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CURRENT_OPERATING_BACKLOG } from "@/lib/agent-os/operating-backlog";
import type { OperatingBacklog } from "@/lib/agent-os/operating-backlog";
import { observationsFromOperatingBacklog } from "./adapters/founder-focus";
import { observationsFromUpcomingBirthdays } from "./adapters/birthdays";
import { SILENCE_REASON } from "./constants";
import { InMemoryChiefOfStaffStore } from "./persistence/memory";
import { ChiefOfStaffPersistenceError } from "./persistence/errors";
import type { ChiefOfStaffStore } from "./persistence/contract";
import { runChiefOfStaffShadow } from "./shadow";
import type { AttentionItem, SpecialistObservation } from "./types";

const GENERATED_AT = "2026-08-25T11:00:00.000Z";
const LOCAL_DATE = "2026-08-25";
const NOW = new Date("2026-08-25T12:00:00.000Z");

function charlotteBacklog(): OperatingBacklog {
  return {
    ...CURRENT_OPERATING_BACKLOG,
    masterSprint: {
      ...CURRENT_OPERATING_BACKLOG.masterSprint,
      items: [
        {
          id: "sprint-charlotte-editorial",
          kind: "founder-action",
          title: "Follow up with Charlotte editorial contact today",
          action: "Follow up with Charlotte editorial contact today",
          why: "Third-party Charlotte authority remains the highest-leverage GEO gap.",
          expectedOutcome: "A real follow-up is sent.",
          status: "active",
          urgency: "high",
          rank: 0,
          surfacePolicy: "founder-now",
        },
        ...CURRENT_OPERATING_BACKLOG.masterSprint.items,
      ],
    },
  };
}

class FailingStore implements ChiefOfStaffStore {
  async upsertItems(): Promise<void> {
    throw new ChiefOfStaffPersistenceError("unavailable");
  }
  async loadItem(): Promise<AttentionItem | null> {
    return null;
  }
  async loadItemsByIds(): Promise<AttentionItem[]> {
    return [];
  }
  async loadItemByDedupeKey(): Promise<AttentionItem | null> {
    return null;
  }
  async loadOpenItemByDedupeKey(): Promise<AttentionItem | null> {
    return null;
  }
  async updateItemLifecycle(): Promise<AttentionItem> {
    throw new ChiefOfStaffPersistenceError("unavailable");
  }
  async putBrief(): Promise<void> {
    throw new ChiefOfStaffPersistenceError("unavailable");
  }
  async getBriefByLocalDate() {
    return null;
  }
}

describe("Chief of Staff Phase 1B shadow persist → reload", () => {
  it("Watch printer inputs persist a quiet brief with ZERO numbered items", async () => {
    const store = new InMemoryChiefOfStaffStore({ nowIso: () => GENERATED_AT });
    const result = await runChiefOfStaffShadow({
      localDate: LOCAL_DATE,
      generatedAt: GENERATED_AT,
      observations: observationsFromOperatingBacklog(
        CURRENT_OPERATING_BACKLOG,
        GENERATED_AT,
      ),
      store,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.durable, true);
    assert.equal(result.items.length, 0);
    assert.deepEqual(result.brief.attentionItemIds, []);
    assert.equal(result.brief.silenceReason, SILENCE_REASON);
    assert.equal(result.commandCenter.status, "quiet");
    assert.match(result.email.text, /No material founder priorities require action today/);
    assert.doesNotMatch(result.email.text, /Watch/i);
    assert.doesNotMatch(result.email.text, /Paid-search readiness/i);
    assert.doesNotMatch(result.email.text, /Weddington/i);
    const reloaded = await store.getBriefByLocalDate(LOCAL_DATE);
    assert.equal(reloaded?.silenceReason, SILENCE_REASON);
  });

  it("persists one founder-now item and reloads the same id/order on both presenters", async () => {
    const store = new InMemoryChiefOfStaffStore({ nowIso: () => GENERATED_AT });
    const observations = observationsFromOperatingBacklog(
      charlotteBacklog(),
      GENERATED_AT,
    );
    const result = await runChiefOfStaffShadow({
      localDate: LOCAL_DATE,
      generatedAt: GENERATED_AT,
      observations,
      store,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.items.length, 1);
    assert.equal(result.brief.attentionItemIds.length, 1);
    assert.equal(result.brief.attentionItemIds[0], result.items[0]?.id);
    assert.equal(result.commandCenter.items[0]?.id, result.items[0]?.id);
    assert.match(result.email.text, /1\. Follow up with Charlotte editorial contact today/);
    assert.doesNotMatch(result.email.text, /Watch/i);
    assert.equal(result.brief.silenceReason, undefined);
    const second = await runChiefOfStaffShadow({
      localDate: LOCAL_DATE,
      generatedAt: "2026-08-25T18:00:00.000Z",
      observations,
      store,
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.brief.id, result.brief.id);
    assert.equal(second.items[0]?.id, result.items[0]?.id);
  });

  it("persists a birthday as worth-knowing only, with no age or year", async () => {
    const store = new InMemoryChiefOfStaffStore({ nowIso: () => GENERATED_AT });
    const observations = observationsFromUpcomingBirthdays({
      birthdays: [
        {
          factId: "fact-sarah",
          personId: "11111111-1111-4111-8111-111111111111",
          displayName: "Sarah",
          month: 9,
          day: 2,
          year: 1988,
          verification: "manual",
          sourceSystem: "concierge-manual",
        },
      ],
      now: NOW,
      observedAt: GENERATED_AT,
    });
    const result = await runChiefOfStaffShadow({
      localDate: LOCAL_DATE,
      generatedAt: GENERATED_AT,
      observations,
      store,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.items.length, 0);
    assert.equal(result.brief.worthKnowing.length, 1);
    assert.equal(
      result.brief.worthKnowing[0]?.headline,
      "Sarah's birthday is in 8 days.",
    );
    assert.doesNotMatch(result.brief.worthKnowing[0]!.headline, /1988|age|years old/i);
    assert.equal(result.commandCenter.worthKnowing[0]?.headline, result.brief.worthKnowing[0]?.headline);
    assert.match(result.email.text, /Sarah's birthday is in 8 days/);
    assert.equal(result.brief.silenceReason, SILENCE_REASON);
  });

  it("does not claim a durable brief when persistence is unavailable", async () => {
    const result = await runChiefOfStaffShadow({
      localDate: LOCAL_DATE,
      generatedAt: GENERATED_AT,
      observations: [] as SpecialistObservation[],
      store: new FailingStore(),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.durable, false);
    assert.equal(result.code, "unavailable");
    assert.equal("brief" in result, false);
    assert.equal("email" in result, false);
  });

  it("does not claim a durable brief when a later item fails entity validation", async () => {
    const PERSON = "11111111-1111-4111-8111-111111111111";
    const PROJECT = "22222222-2222-4222-8222-222222222222";
    const store = new InMemoryChiefOfStaffStore({
      nowIso: () => GENERATED_AT,
      entities: {
        async getKind(id) {
          if (id === PERSON) return "person";
          if (id === PROJECT) return "project";
          return null;
        },
      },
    });
    const observations: SpecialistObservation[] = [
      {
        specialist: "founder-focus",
        kind: "founder-focus-now",
        subject: { personId: PERSON },
        summary: "Follow up with Charlotte editorial contact today",
        whyItMatters: "Authority gap.",
        recommendedAction: "Follow up with Charlotte editorial contact today",
        epistemicClass: "observed",
        importanceHint: "high",
        urgencyHint: "today",
        audienceHint: "founder-action",
        confidence: "high",
        evidenceIds: [],
        observationIds: [],
        observedAt: GENERATED_AT,
        dedupeKey: "founder-focus:ok",
        changeClass: "novel",
      },
      {
        specialist: "founder-focus",
        kind: "founder-focus-now",
        subject: { personId: PROJECT },
        summary: "Invalid project as person",
        epistemicClass: "observed",
        importanceHint: "high",
        urgencyHint: "today",
        audienceHint: "founder-action",
        confidence: "high",
        evidenceIds: [],
        observationIds: [],
        observedAt: GENERATED_AT,
        dedupeKey: "founder-focus:bad",
        changeClass: "novel",
      },
    ];
    const result = await runChiefOfStaffShadow({
      localDate: LOCAL_DATE,
      generatedAt: GENERATED_AT,
      observations,
      store,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.durable, false);
    assert.equal(result.code, "entity-kind-invalid");
    assert.equal(await store.getBriefByLocalDate(LOCAL_DATE), null);
  });
});
