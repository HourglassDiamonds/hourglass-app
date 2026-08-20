/**
 * Ledger System Temperature — append-only series and published reading.
 * First official v1 baseline: August 12, 2026.
 * Do not compare to archived GPI / monitor numerical scores.
 */

import {
  computeTemperatureDegrees,
  publishTemperatureReading,
} from "./compute";
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

/**
 * August 18, 2026 channel assessment — assigned after monitor evidence review.
 * Discrete geo and infrastructure ST levels are unchanged from August 12.
 * The published move is produced by financial pressure/transmission rising
 * from elevated/contained to high/partial.
 */
export const SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_18: SystemTemperatureSnapshot =
  {
    reviewDate: "August 18, 2026",
    evidenceCutoff: "August 18, 2026",
    methodologyVersion: SYSTEM_TEMPERATURE_METHODOLOGY_VERSION,
    channels: [
      {
        id: "geopolitics-energy-supply",
        pressure: "severe",
        transmission: "partial",
        materialChange: false,
        transmissionExplanation:
          "The U.S.–Iran negotiating window expired without an extension or scheduled talks, Hormuz transit remained in single digits, and Brent established a higher ~$90–91 regime. Transmission remains into energy prices; financial-path effects are scored in the financial channel rather than as broader geo transmission.",
        coolingNotes:
          "Alternative Gulf crude-routing continues to keep the shock below a $100-style supply seizure. Non-energy manufacturing and credit-system function have not confirmed broad transmission.",
        evidenceRefs: [
          "global-pressure",
          "CNBC / Guardian oil and Hormuz coverage Aug 17–18, 2026",
          "Kpler / UKMTO shipping prints Aug 16–18, 2026",
        ],
      },
      {
        id: "financial-economic",
        pressure: "high",
        transmission: "partial",
        materialChange: true,
        transmissionExplanation:
          "Long-duration sovereign yields repriced as energy/inflation pressure, fiscal issuance, AI-infrastructure capital demand, and term-premium interacted — U.S. 30-year around 5.32–5.33% (highest since 2007) and 10-year above ~4.7%, with parallel duration pressure in Europe and Japan. Near-term Fed-hike odds softened on weaker jobs, CPI, and retail. This is rates transmission, not credit-system dysfunction.",
        coolingNotes:
          "No verified broad credit-spread or funding-market dysfunction is present in the evidence reviewed. FRED ICE BofA IG/HY OAS observations through August 17 remained near historically tight levels (IG 0.81 / HY 2.70). Equities repriced; they were not disorderly.",
        evidenceRefs: [
          "CNBC / AA 30-year Treasury coverage Aug 18, 2026",
          "FRED BAMLC0A0CM and BAMLH0A0HYM2 through August 17, 2026",
          "July 2026 CPI, payrolls, and retail-sales prints",
        ],
      },
      {
        id: "physical-infrastructure",
        pressure: "high",
        transmission: "partial",
        materialChange: true,
        transmissionExplanation:
          "PJM’s 6,831 MW 2028/29 adequacy shortfall, reliability backstop, and IRAS / large-load framework remain the U.S. planning constraint. European drought added confirmed hydro, nuclear-cooling, and Rhine/Danube freight consequences. Systems still operate with active adaptation — the discrete ST level stays high/partial, matching the multi-regional ‘systems still operating’ fixture precedent.",
        coolingNotes:
          "No synchronized continental grid failure. Operators are adapting through backstop procurement, imports, alternate generation, and emergency river measures. July DOE emergency-order windows and World Cup infrastructure load are not current heat.",
        evidenceRefs: [
          "PJM IRAS / reliability-backstop materials",
          "CNBC / BBC / DW European drought, nuclear, and river reporting",
          "infrastructure-strain monitor",
          "global-water-stress monitor",
        ],
      },
      {
        id: "commodities-materials",
        pressure: "elevated",
        transmission: "contained",
        materialChange: false,
        transmissionExplanation:
          "Gold remains around the $4,400 area as safe-haven and official-sector demand compete with higher long-duration yields. Diamond markets stay segmented rather than broadly dysfunctional.",
        coolingNotes:
          "Spot-gold movement is not a materials-regime break. Jewelry sourcing remains selectively firm.",
        evidenceRefs: [
          "World Gold Council Q2 2026",
          "Reuters / LBMA gold around $4,390–4,450 Aug 18, 2026",
          "precious-materials monitor",
        ],
      },
      {
        id: "technology-ai",
        pressure: "elevated",
        transmission: "partial",
        materialChange: false,
        transmissionExplanation:
          "Frontier capability continues to broaden, including Gemini 3.7 Flash and large AI/data-center financing, but deployment remains infrastructure-bound. Physical grid and large-load constraints are scored in the infrastructure channel rather than as an additional AI temperature increase.",
        coolingNotes:
          "Model-access and financing developments are not unconstrained deployment. Electricity, interconnection, and capital structure remain co-equal limits.",
        evidenceRefs: [
          "Google Gemini 3.7 Flash Aug 13, 2026",
          "OpenAI / Nvidia / SB Energy Ohio 8 GW lease reporting Aug 17, 2026",
          "ai-capability monitor",
        ],
      },
    ],
    confidence: "moderate",
    confidenceRationale:
      "Physical evidence is clearer — single-digit Hormuz prints, Brent above $90, expired talks, long yields, and European water-to-power effects. Strategic intent, Hormuz control claims, Oman’s role, and diplomatic path remain highly uncertain, so confidence stays Moderate.",
    activeEvents: [
      {
        id: "hormuz-corridor-disruption-2026",
        label: "Strait of Hormuz / Gulf shipping disruption",
        firstIncorporatedReview: "August 12, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "August 12, 2026",
        decayEligible: false,
        notes:
          "Baseline already incorporated prolonged Hormuz constraint and partial energy-price transmission. August 18 updates facts (expired MoU, higher oil print) without a discrete geo pressure or transmission-level change.",
      },
      {
        id: "pjm-large-load-adequacy-2026",
        label: "PJM large-load / resource-adequacy framework",
        firstIncorporatedReview: "August 12, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "August 12, 2026",
        decayEligible: false,
        notes:
          "Structural PJM adequacy pressure remains in the baseline. Continuation does not add degrees. Expired July emergency-order windows stay historical context.",
      },
      {
        id: "sovereign-duration-repricing-2026",
        label: "Long-duration sovereign yield repricing",
        firstIncorporatedReview: "August 18, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "August 18, 2026",
        decayEligible: false,
        notes:
          "Primary August 18 temperature driver. Rates transmission from interacting energy, fiscal, and AI-capital pressures — not a credit-system crisis.",
      },
      {
        id: "europe-water-power-freight-2026",
        label: "European drought / water-constrained power and freight",
        firstIncorporatedReview: "August 18, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "August 18, 2026",
        decayEligible: false,
        notes:
          "Counted once as downstream physical-infrastructure consequences. Does not create a separate System Temperature water weight and does not raise infrastructure from high to very-high.",
      },
    ],
    coolingReview: {
      improved:
        "Softer U.S. July jobs, CPI, and retail prints reduced near-term Fed-hike expectations. 2026 Iraqi Tigris–Euphrates water conditions improved after winter rainfall and higher reserves.",
      normalized:
        "No broad equity-market dysfunction. Reviewed credit spreads through August 17 remained relatively contained rather than crisis-wide.",
      failedToTransmit:
        "Severe Hormuz disruption has not produced a funding-market seizure, broad credit-system dysfunction, or a generalized manufacturing / non-energy supply-chain shutdown.",
      absorbed:
        "Alternative Gulf crude-routing remains functional; producers are adapting export logistics; PJM and European grid operators are actively adapting, including imports and alternate generation where available.",
      decayed:
        "July DOE emergency grid orders, the World Cup infrastructure/security window, stale August 3 weekly catalysts, and August 12 ‘fresh catalyst’ framing are no longer current heat.",
    },
    pressureLabel: "High Pressure",
    functioningLabel: "Systems Functioning",
    explanation:
      "Long-duration borrowing costs have repriced as energy, fiscal issuance, and AI-infrastructure capital demand interact, even while near-term Fed-hike expectations softened and credit markets continued to function. Physical systems remain under persistent strain, now visible in both U.S. large-load adequacy planning and European water-constrained power and freight, but operators are adapting and normal system function is intact. Corridor pressure remains severe with partial energy transmission.",
  };

export const SYSTEM_TEMPERATURE_SNAPSHOTS: readonly SystemTemperatureSnapshot[] =
  [
    SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_12,
    SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_18,
  ];

export const SYSTEM_TEMPERATURE_READING: SystemTemperatureReading =
  publishTemperatureReading(SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_18, {
    previousDegrees: computeTemperatureDegrees(
      SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_12,
    ),
  });

/** Public hub interpretation under System Temperature. Not a methodology input. */
export const SYSTEM_TEMPERATURE_LEDGER_NOTE =
  "Pressure has broadened beyond the original energy shock. Long-duration borrowing costs are now repricing alongside persistent corridor disruption, while water and grid constraints are producing real physical effects across multiple regions. The system remains functional and adaptive, but the transmission is broader than it was at the August 12 baseline.";

if (!SYSTEM_TEMPERATURE_READING.validation.ok) {
  throw new Error(
    `System Temperature failed validation: ${SYSTEM_TEMPERATURE_READING.validation.issues
      .map((issue) => issue.message)
      .join("; ")}`,
  );
}
