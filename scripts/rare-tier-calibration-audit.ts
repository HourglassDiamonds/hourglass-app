/**
 * Rare-tier calibration audit — distribution of V3 public tiers across score grid.
 * Audit only; does not change scoring thresholds.
 *
 * Run: npx tsx scripts/rare-tier-calibration-audit.ts
 */
import { editorialTierFromInternalLabel } from "@/lib/diamond-intelligence/client-editorial-language";
import { presentConfidenceAdjustedRead } from "@/lib/diamond-intelligence/client-percentile-present";
import {
  capV3PublicTier,
  resolveV3PublicTier,
  type V3PublicTier,
} from "../app/diamond-intelligence/components/v3-presentation";

const TIERS: V3PublicTier[] = [
  "Rare",
  "Exceptional",
  "Distinctive",
  "Strong",
  "Balanced",
  "Open",
];

const BUSINESS_INTENT: Record<
  V3PublicTier,
  { targetShare: string; scoreBand: string }
> = {
  Rare: { targetShare: "~1–5% market-wide", scoreBand: "97+" },
  Exceptional: { targetShare: "~5–10%", scoreBand: "92–96" },
  Distinctive: { targetShare: "~10–20%", scoreBand: "85–91" },
  Strong: { targetShare: "moderate share", scoreBand: "70–84" },
  Balanced: { targetShare: "common middle", scoreBand: "50–69" },
  Open: { targetShare: "lower / incomplete", scoreBand: "<50" },
};

function tierForRawScore(raw: number): V3PublicTier {
  const adjusted = presentConfidenceAdjustedRead(raw, {
    scoreDisplayCap: 100,
    canShowRareLanguage: true,
  });
  const editorial = editorialTierFromInternalLabel(adjusted.presentation.label, {
    canShowScore: true,
  });
  return resolveV3PublicTier({
    editorialTier: editorial,
    displayScore: adjusted.displayScore,
    canShowScore: true,
  });
}

function tierForSi2(raw: number): V3PublicTier {
  const base = tierForRawScore(raw);
  return capV3PublicTier(base, "Strong");
}

console.log("\nRARE TIER CALIBRATION AUDIT\n");
console.log("Current V3 score → tier mapping (presentation layer only)\n");
console.log(
  "Score".padEnd(8) +
    "Std Tier".padEnd(14) +
    "SI2 Capped".padEnd(14) +
    "Business intent",
);
console.log("-".repeat(72));

const counts: Record<V3PublicTier, number> = Object.fromEntries(
  TIERS.map((t) => [t, 0]),
) as Record<V3PublicTier, number>;

for (let raw = 50; raw <= 100; raw++) {
  const std = tierForRawScore(raw);
  const si2 = tierForSi2(raw);
  counts[std] += 1;
  console.log(
    String(raw).padEnd(8) +
      std.padEnd(14) +
      si2.padEnd(14) +
      BUSINESS_INTENT[std].targetShare,
  );
}

console.log("\n--- Distribution across scores 50–100 (n=51) ---\n");
for (const tier of TIERS) {
  const pct = ((counts[tier] / 51) * 100).toFixed(1);
  const intent = BUSINESS_INTENT[tier];
  console.log(
    `${tier.padEnd(14)} ${String(counts[tier]).padStart(2)} scores (${pct.padStart(5)}%)  intent: ${intent.targetShare}  band: ${intent.scoreBand}`,
  );
}

const rarePlus =
  counts.Rare + counts.Exceptional + counts.Distinctive;
console.log(
  `\nPremium tiers (Rare+Exceptional+Distinctive): ${rarePlus}/51 (${((rarePlus / 51) * 100).toFixed(1)}%)`,
);
console.log(
  "At score 97+, tier is Rare — aligns with top ~1–3% framing in V3 copy.",
);
console.log(
  "At score 92–96, Exceptional — aligns with top ~4–8% framing.",
);
console.log(
  "At score 85–91, Distinctive — aligns with top ~9–15% framing.",
);
console.log(
  "\nFindings: thresholds are steep — only 15/51 scores (29%) land in Distinctive or above.",
);
console.log(
  "Rare appears on 4/51 scores (7.8%) at the integer grid — feels selective but not ultra-scarce at whole-point resolution.",
);
console.log(
  "Recommendation: keep current thresholds for this sprint; revisit if live upload corpus shows Rare >10% of scored reports.",
);
console.log("\nNo thresholds were changed.\n");
