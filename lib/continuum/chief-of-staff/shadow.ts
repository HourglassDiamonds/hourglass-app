/**
 * Shadow execution: compose → persist → reload → present.
 * Not wired to Command Center, Resend, or cron.
 */

import { composeChiefOfStaffBrief } from "./compose";
import { presentCommandCenter } from "./present/command-center";
import { renderMorningEmail } from "./present/email";
import type { ChiefOfStaffStore } from "./persistence/contract";
import {
  ChiefOfStaffPersistenceError,
  type CosPersistenceCode,
} from "./persistence/errors";
import type {
  AttentionItem,
  ChiefOfStaffBrief,
  ChiefOfStaffCommandCenterView,
  ChiefOfStaffEmailView,
  SpecialistObservation,
} from "./types";

export type RunChiefOfStaffShadowInput = {
  localDate: string;
  generatedAt: string;
  nowIso?: string;
  observations: SpecialistObservation[];
  store: ChiefOfStaffStore;
};

export type ChiefOfStaffShadowSuccess = {
  ok: true;
  durable: true;
  brief: ChiefOfStaffBrief;
  items: AttentionItem[];
  commandCenter: ChiefOfStaffCommandCenterView;
  email: ChiefOfStaffEmailView;
};

export type ChiefOfStaffShadowFailure = {
  ok: false;
  durable: false;
  code: CosPersistenceCode;
};

export type ChiefOfStaffShadowResult =
  | ChiefOfStaffShadowSuccess
  | ChiefOfStaffShadowFailure;

async function existingItemsForObservations(
  store: ChiefOfStaffStore,
  observations: SpecialistObservation[],
): Promise<AttentionItem[]> {
  const seen = new Set<string>();
  const existing: AttentionItem[] = [];
  for (const observation of observations) {
    if (seen.has(observation.dedupeKey)) continue;
    seen.add(observation.dedupeKey);
    const open = await store.loadOpenItemByDedupeKey(observation.dedupeKey);
    const prior = open ?? (await store.loadItemByDedupeKey(observation.dedupeKey));
    if (prior) existing.push(prior);
  }
  return existing;
}

export async function runChiefOfStaffShadow(
  input: RunChiefOfStaffShadowInput,
): Promise<ChiefOfStaffShadowResult> {
  try {
    const composed = composeChiefOfStaffBrief({
      localDate: input.localDate,
      generatedAt: input.generatedAt,
      nowIso: input.nowIso ?? input.generatedAt,
      observations: input.observations,
      existingItems: await existingItemsForObservations(
        input.store,
        input.observations,
      ),
    });
    await input.store.upsertItems(composed.items);
    await input.store.putBrief(composed.brief);
    const brief = await input.store.getBriefByLocalDate(input.localDate);
    if (!brief) {
      return { ok: false, durable: false, code: "unavailable" };
    }
    const items = await input.store.loadItemsByIds(brief.attentionItemIds);
    if (items.length !== brief.attentionItemIds.length) {
      return { ok: false, durable: false, code: "unavailable" };
    }
    return {
      ok: true,
      durable: true,
      brief,
      items,
      commandCenter: presentCommandCenter({ brief, items }),
      email: renderMorningEmail({ brief, items }),
    };
  } catch (error) {
    if (error instanceof ChiefOfStaffPersistenceError) {
      return { ok: false, durable: false, code: error.code };
    }
    return { ok: false, durable: false, code: "unavailable" };
  }
}
