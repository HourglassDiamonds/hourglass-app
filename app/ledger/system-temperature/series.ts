/**
 * Ledger System Temperature — append-only series and published reading.
 * First official v1 baseline: August 12, 2026.
 * Do not compare to archived GPI / monitor numerical scores.
 */

import { publishTemperatureReading } from "./compute";
import { SYSTEM_TEMPERATURE_METHODOLOGY_VERSION } from "./methodology";
import type { SystemTemperatureReading, SystemTemperatureSnapshot } from "./types";

export const SYSTEM_TEMPERATURE_SERIES_ID = "ledger-system-temperature";

/**
 * August 12, 2026 channel assessment — assigned only after monitor evidence review.
 *
 * Geo/energy: severe corridor disruption (Hormuz traffic still a fraction of
 * pre-conflict norms; fresh shipping attacks; Brent near $90) with partial
 * energy-price transmission, not credit-system seizure.
 *
 * Financial: elevated inflation/policy-path risk from the energy premium, but
 * credit spreads remain near historically tight levels — contained transmission.
 *
 * Infrastructure: elevated-to-high structural large-load / resource-adequacy
 * strain (PJM IRAS framework), systems still functioning.
 *
 * Materials: elevated firmness (gold near $4,400; structural official-sector
 * demand) without jewelry-market dysfunction.
 *
 * Technology/AI: elevated capability/access pressure, deployment still
 * infrastructure-bound.
 */
export const SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_12: SystemTemperatureSnapshot =
  {
    reviewDate: "August 12, 2026",
    evidenceCutoff: "August 12, 2026",
    methodologyVersion: SYSTEM_TEMPERATURE_METHODOLOGY_VERSION,
    isBaselineReading: true,
    channels: [
      {
        id: "geopolitics-energy-supply",
        pressure: "severe",
        transmission: "partial",
        materialChange: true,
        transmissionExplanation:
          "Hormuz transit remains far below pre-conflict norms (Reuters-cited Kpler ~8 / LSEG ~11 vs ~130–140 daily pre-conflict), fresh shipping attacks raised the energy-risk premium, and Brent traded around $89 — partial transmission into energy prices without confirmed credit-market seizure.",
        coolingNotes:
          "Diplomatic reopen signals did not restore normal corridor function; prior late-July / early-August easing narrative lost force as attacks and deadlock reasserted the premium.",
        evidenceRefs: [
          "global-pressure",
          "Reuters Hormuz traffic / Kpler-LSEG Aug 12, 2026",
          "Reuters oil / Brent ~$89 Aug 12, 2026",
          "EIA STEO",
        ],
      },
      {
        id: "financial-economic",
        pressure: "elevated",
        transmission: "contained",
        materialChange: false,
        transmissionExplanation:
          "Energy-premium and policy-path risk remain live, but reviewed credit-spread measures stayed near historically tight levels and did not confirm crisis-style funding stress.",
        coolingNotes:
          "Markets continue to absorb elevated oil without a systemic credit rupture; inflation transmission into a full financial-stress event remains unconfirmed ahead of the August 12 CPI print.",
        evidenceRefs: [
          "FRED BAMLC0A0CM",
          "Treasury yield coverage ahead of CPI",
        ],
      },
      {
        id: "physical-infrastructure",
        pressure: "high",
        transmission: "partial",
        materialChange: true,
        transmissionExplanation:
          "PJM’s Interim Resource Adequacy / large-load framework treats AI data-center growth as a binding reliability and capacity-planning constraint, with curtailment pathways proposed for non-firm large loads from 2027 — structural strain transmitting into interconnection and siting conditions while systems still operate.",
        coolingNotes:
          "Expired mid-July DOE emergency-order and Maximum Generation alert windows no longer describe current conditions; the live issue is structural large-load adequacy, not an active summer emergency order.",
        evidenceRefs: [
          "PJM IRAS board PDF",
          "infrastructure-strain monitor",
        ],
      },
      {
        id: "commodities-materials",
        pressure: "elevated",
        transmission: "contained",
        materialChange: false,
        transmissionExplanation:
          "Gold traded near the $4,400 area with continued official-sector accumulation in the latest World Gold Council quarterly read; diamond markets remain segmented rather than broadly dysfunctional.",
        coolingNotes:
          "Spot-price movement around $4,400 is not treated as a materials-regime break; jewelry sourcing remains selectively firm rather than seized.",
        evidenceRefs: [
          "World Gold Council Q2 2026",
          "LBMA / spot gold near $4,400",
          "precious-materials monitor",
        ],
      },
      {
        id: "technology-ai",
        pressure: "elevated",
        transmission: "partial",
        materialChange: true,
        transmissionExplanation:
          "OpenAI’s August 6 ChatGPT updates broadened consumer access paths for the GPT-5.6 family while leaving Work/Codex versions distinct — capability and access continue to expand beneath grid and large-load constraints.",
        coolingNotes:
          "Model-access broadening is not equivalent to unconstrained deployment; physical power and interconnection remain co-equal limits.",
        evidenceRefs: [
          "OpenAI Aug 6, 2026 ChatGPT update",
          "ai-capability monitor",
        ],
      },
    ],
    confidence: "moderate",
    confidenceRationale:
      "Information layers diverge on Hormuz control, reopening prospects, and recovered oil-flow claims versus Reuters-cited Kpler/LSEG transit counts; density is high and clarity is uneven, so confidence is Moderate rather than High.",
    activeEvents: [
      {
        id: "hormuz-corridor-disruption-2026",
        label: "Strait of Hormuz / Gulf shipping disruption",
        firstIncorporatedReview: "August 12, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "August 12, 2026",
        decayEligible: false,
        notes:
          "Baseline v1 incorporates prolonged Hormuz constraint and related energy-premium transmission. Further upward moves require material change, not mere continuation.",
      },
      {
        id: "pjm-large-load-adequacy-2026",
        label: "PJM large-load / resource-adequacy framework",
        firstIncorporatedReview: "August 12, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "August 12, 2026",
        decayEligible: false,
        notes:
          "Structural grid/data-center adequacy pressure is in the baseline. Expired July emergency-order windows are not carried forward as live heat.",
      },
    ],
    coolingReview: {
      improved:
        "Mid-July PJM alert language and DOE Order 202-26-35 (July 14–21) are no longer treated as live upcoming emergency windows.",
      normalized:
        "No corridor normalization — Hormuz transit remains far below pre-conflict norms despite intermittent diplomatic headlines.",
      failedToTransmit:
        "The energy-risk premium has not produced crisis-level credit or funding stress; reviewed spreads remain near historically tight levels.",
      absorbed:
        "Equity and rate markets continue to digest elevated oil and geopolitics without confirmed systemic dislocation.",
      decayed:
        "The early-August narrative of near-term financial easing after a pause in planned military action no longer describes the live tape after renewed shipping attacks and faded reopen hopes.",
    },
    pressureLabel: "High Pressure",
    functioningLabel: "Systems Functioning",
    explanation:
      "Severe corridor and energy pressure is transmitting into oil prices, while credit markets and broader system function remain intact — elevated multi-channel strain, not systemic dysfunction.",
  };

export const SYSTEM_TEMPERATURE_SNAPSHOTS: readonly SystemTemperatureSnapshot[] =
  [SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_12];

export const SYSTEM_TEMPERATURE_READING: SystemTemperatureReading =
  publishTemperatureReading(SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_12, {
    isBaseline: true,
    previousDegrees: null,
  });

if (!SYSTEM_TEMPERATURE_READING.validation.ok) {
  throw new Error(
    `System Temperature failed validation: ${SYSTEM_TEMPERATURE_READING.validation.issues
      .map((issue) => issue.message)
      .join("; ")}`,
  );
}
