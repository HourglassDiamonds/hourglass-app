/**
 * Shared seed-draft builder for the fan-out question universe.
 */

import { slugifyFanOutId } from "./normalize";
import type {
  AudienceStage,
  FanOutGeography,
  FanOutQuestion,
  FanOutSearchIntent,
  QueryFamily,
  QuestionSource,
} from "./types";

export const SEED_STAMP = "2026-07-27T00:00:00.000Z";
export const SEED_STAMP_V11 = "2026-07-28T00:00:00.000Z";

export type SeedDraft = {
  question: string;
  family: QueryFamily;
  intent: FanOutSearchIntent;
  stage: AudienceStage;
  geography?: FanOutGeography;
  commercial: number;
  authority: number;
  matchTerms: string[];
  entities?: string[];
  topics?: string[];
  source?: QuestionSource;
  sourceRef?: string | null;
  aliases?: string[];
  duplicateOf?: string;
  status?: FanOutQuestion["status"];
  stamp?: string;
};

export function buildFanOutSeedQuestion(draft: SeedDraft): FanOutQuestion {
  const stamp = draft.stamp ?? SEED_STAMP;
  const id = `fan-out-q:${slugifyFanOutId(draft.question)}`;
  return {
    id,
    canonicalQuestion: draft.question,
    queryFamily: draft.family,
    searchIntent: draft.intent,
    audienceStage: draft.stage,
    geography: draft.geography ?? "unspecified",
    commercialValue: draft.commercial,
    authorityValue: draft.authority,
    source: draft.source ?? "seed-curated",
    sourceRef: draft.sourceRef ?? null,
    status: draft.status ?? "active",
    aliases: draft.aliases ?? [],
    matchTerms: draft.matchTerms,
    entities: draft.entities ?? [],
    topics: draft.topics ?? [draft.family],
    duplicateOfId: draft.duplicateOf
      ? `fan-out-q:${slugifyFanOutId(draft.duplicateOf)}`
      : null,
    createdAt: stamp,
    updatedAt: stamp,
  };
}
