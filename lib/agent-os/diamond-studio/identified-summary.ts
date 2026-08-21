/**
 * Identified Studio activity summary.
 * Observed actions only — never “ready to buy.”
 */

import {
  formatBandWidthForCard,
  formatStudioCardCopy,
  METAL_DISPLAY_LABELS,
  SHAPE_DISPLAY_LABELS,
} from "@/lib/diamond-studio/configuration";
import type { StudioViewEmailedRecord } from "@/lib/diamond-studio/email-view/types";
import { maskStudioViewEmail } from "@/lib/diamond-studio/email-view/validate";
import type {
  IdentifiedStudioActivitySummary,
  StudioActivitySummary,
  StudioAgentAnonymousEvent,
} from "./types";

const INTENT_LANGUAGE = /ready to buy|hot lead|intent to purchase|will convert/i;

export function summarizeIdentifiedStudioActivity(
  records: readonly StudioViewEmailedRecord[],
): IdentifiedStudioActivitySummary {
  const lines = records.map((record) => {
    const copy = formatStudioCardCopy(record.configuration);
    return {
      maskedEmail: maskStudioViewEmail(record.emailNormalized),
      configurationLabel: `${copy.headline} · ${METAL_DISPLAY_LABELS[record.configuration.metal]} · ${formatBandWidthForCard(record.configuration.bandWidth)}`,
    };
  });

  const notes = [
    "Identified activity is Email This View only. It is not marketing consent.",
    "Do not infer purchase intent from an emailed configuration.",
    "Concierge matching is exact normalized email after an explicit inquiry.",
  ];

  return {
    emailedCount: records.length,
    lines,
    identityInvented: false,
    purchaseIntentInferred: false,
    notes,
  };
}

export function formatIdentifiedStudioSignal(
  record: StudioViewEmailedRecord,
): string {
  const shape = SHAPE_DISPLAY_LABELS[record.configuration.shape];
  const metal = METAL_DISPLAY_LABELS[record.configuration.metal];
  const carat = record.configuration.carat.toFixed(1);
  return `One identified visitor emailed a ${carat} ct ${shape} / ${metal} configuration.`;
}

export function identifiedSummaryInventedIntent(
  summary: IdentifiedStudioActivitySummary,
): boolean {
  return (
    summary.purchaseIntentInferred ||
    INTENT_LANGUAGE.test(summary.notes.join(" ")) ||
    INTENT_LANGUAGE.test(summary.lines.map((line) => line.configurationLabel).join(" "))
  );
}

export function formatStudioDailyIntelligencePrep(input: {
  anonymous: readonly StudioAgentAnonymousEvent[];
  identified: readonly StudioViewEmailedRecord[];
  anonymousSummary: StudioActivitySummary;
}): string {
  const identified = summarizeIdentifiedStudioActivity(input.identified);
  const engaged = input.anonymous.filter(
    (event) => event.event === "studio_session_engaged",
  ).length;
  const snapshots = input.anonymousSummary.snapshotCount;
  const shared = input.anonymous.filter(
    (event) => event.event === "studio_snapshot_shared",
  ).length;

  const identifiedBlock = identified.lines
    .map((line) => `${line.maskedEmail}\n${line.configurationLabel}`)
    .join("\n\n");

  return [
    "Diamond Studio — Today",
    `* ${engaged} meaningful sessions`,
    `* ${snapshots} snapshots created`,
    `* ${shared} images shared`,
    `* ${identified.emailedCount} views emailed`,
    "",
    "Identified activity",
    identifiedBlock || "None.",
  ].join("\n");
}
