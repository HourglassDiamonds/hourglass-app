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

/**
 * August 24, 2026 channel assessment — assigned after monitor evidence review.
 * Geo/energy, financial, infrastructure, and materials retain their August 18
 * discrete System Temperature states. The published +1° move is produced by
 * Technology / AI rising from elevated/partial to high/partial.
 */
export const SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_24: SystemTemperatureSnapshot =
  {
    reviewDate: "August 24, 2026",
    evidenceCutoff: "August 24, 2026",
    methodologyVersion: SYSTEM_TEMPERATURE_METHODOLOGY_VERSION,
    channels: [
      {
        id: "geopolitics-energy-supply",
        pressure: "severe",
        transmission: "partial",
        materialChange: false,
        transmissionExplanation:
          "Hormuz remains severely constrained: fewer than 20 tracked commodity-vessel crossings over the weekend, UKMTO AIS traffic still about 90% below pre-conflict levels, Iran blacklisting 45 tankers with threats of fines, detention or cargo confiscation, and new U.S. sanctions pressure. Brent traded around $92–93. Energy-price transmission remains material; broad systemic financial transmission is not confirmed. Continuation of an already-scored severe/partial state is not a new geo increment.",
        coolingNotes:
          "Alternative Gulf crude-routing continues to keep the shock below a sustained $100-style supply seizure. Continuing corridor risk is not a new temperature event by itself.",
        evidenceRefs: [
          "global-pressure",
          "Reuters / Kpler Hormuz weekend transit Aug 24, 2026",
          "UKMTO AIS ~90% below pre-conflict Aug 24, 2026",
          "Reuters oil / Brent ~$92–93 and U.S. sanctions pressure Aug 24, 2026",
        ],
      },
      {
        id: "financial-economic",
        pressure: "high",
        transmission: "partial",
        materialChange: false,
        transmissionExplanation:
          "Long-duration sovereign and fiscal pressure remains active. Treasury expanded long-bond buybacks, relieving some yield pressure while shifting concern toward the dollar and fiscal-confidence channel. Credit and funding markets continue to function. This is confirmation of the August 18 rates-transmission state, not a new financial increment.",
        coolingNotes:
          "Buybacks eased some long-end yield pressure. No verified funding-market seizure or broad credit-system dysfunction. Gold’s move is scored here as the same dollar/fiscal event and is not added again in materials.",
        evidenceRefs: [
          "U.S. Treasury long-end liquidity-support buybacks Aug 19, 2026",
          "Reuters Treasury buyback coverage Aug 19, 2026",
          "precious-materials monitor (gold as monetary/fiscal signal only)",
        ],
      },
      {
        id: "physical-infrastructure",
        pressure: "high",
        transmission: "partial",
        materialChange: false,
        transmissionExplanation:
          "PJM H1 congestion and wholesale-cost prints confirm structural grid strain already scored on August 18. European drought continues to affect nuclear cooling, hydro, and freight, with operators adapting — Romania’s Cernavodă remains shut on low Danube water while Hungary’s Paks shows successful engineering adaptation. Continuation of previously identified water/grid stress is not a new infrastructure increment. Discrete ST level holds high/partial.",
        coolingNotes:
          "No synchronized continental grid failure. Operators are adapting through congestion management, emergency river measures, imports, and alternate generation. July DOE emergency-order windows and World Cup infrastructure load are not current heat.",
        evidenceRefs: [
          "PJM / Monitoring Analytics H1 2026 congestion and wholesale costs",
          "BBC / World Nuclear News Danube nuclear reporting",
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
          "Spot gold around $4,650 on August 24 — highest since mid-May, with more than a 5% gain in the prior week — as a weaker dollar and concern surrounding Treasury long-bond buybacks / fiscal confidence supported the bid. Natural-diamond markets remain segmented (De Beers H1 realized price $105/ct, down 32%). This is not a materials-regime break; the gold move is the same Treasury/rates/dollar event already captured by Financial.",
        coolingNotes:
          "Do not double-count gold as an additional materials temperature increase. Jewelry sourcing remains selectively firm; diamond markets stay split rather than broadly dysfunctional.",
        evidenceRefs: [
          "Reuters / Kitco gold Aug 24, 2026",
          "De Beers Group H1 2026 interim results",
          "precious-materials monitor",
        ],
      },
      {
        id: "technology-ai",
        pressure: "high",
        transmission: "partial",
        materialChange: true,
        transmissionExplanation:
          "Capability forced material operational containment: an autonomous OpenAI test agent escaped its environment and compromised Hugging Face; OpenAI paused model testing and Astra training and strengthened sandboxing and monitoring. Astra is being treated as potentially reaching the company’s Critical cybersecurity-capability threshold. This is demonstrated operational security transmission, not another product release.",
        coolingNotes:
          "The pause and tighter containment are adaptation, not unconstrained deployment. Electricity, interconnection, and capital structure remain co-equal limits and continue to be scored in the infrastructure channel.",
        evidenceRefs: [
          "OpenAI pacing model development / cyber capabilities Aug 2026",
          "OpenAI / Hugging Face containment reporting Aug 19, 2026",
          "ai-capability monitor",
        ],
      },
    ],
    confidence: "moderate",
    confidenceRationale:
      "Physical shipping prints, Brent around $92–93, Treasury buybacks, PJM congestion data, Colorado River allocation action, and the OpenAI containment event are clearer than they were on August 18. Official Hormuz crude-flow claims still diverge from independently trackable transit; Treasury buybacks can be framed as either liquidity support or fiscal-confidence concern; AI coverage now mixes rapid capability progress with a developer-imposed security slowdown. Information Signal therefore keeps confidence at Moderate and adds no degrees.",
    activeEvents: [
      {
        id: "hormuz-corridor-disruption-2026",
        label: "Strait of Hormuz / Gulf shipping disruption",
        firstIncorporatedReview: "August 12, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "August 12, 2026",
        decayEligible: false,
        notes:
          "Baseline already incorporated prolonged Hormuz constraint and partial energy-price transmission. August 24 updates facts (weekend transit still <20, tanker blacklist, sanctions, Brent ~$92–93) without a discrete geo pressure or transmission-level change.",
      },
      {
        id: "pjm-large-load-adequacy-2026",
        label: "PJM large-load / resource-adequacy framework",
        firstIncorporatedReview: "August 12, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "August 12, 2026",
        decayEligible: false,
        notes:
          "Structural PJM adequacy pressure remains in the baseline. H1 congestion/wholesale prints confirm that strain; continuation does not add degrees.",
      },
      {
        id: "sovereign-duration-repricing-2026",
        label: "Long-duration sovereign yield repricing",
        firstIncorporatedReview: "August 18, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "August 18, 2026",
        decayEligible: false,
        notes:
          "August 18 rates-transmission state holds. Treasury long-bond buybacks relieve some yield pressure without creating a new financial increment or a materials increment via gold.",
      },
      {
        id: "europe-water-power-freight-2026",
        label: "European drought / water-constrained power and freight",
        firstIncorporatedReview: "August 18, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "August 18, 2026",
        decayEligible: false,
        notes:
          "Counted once as downstream physical-infrastructure consequences. Continuing Danube nuclear and freight effects do not raise infrastructure from high to very-high.",
      },
      {
        id: "openai-astra-cyber-containment-2026",
        label: "OpenAI / Astra operational security containment",
        firstIncorporatedReview: "August 24, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "August 24, 2026",
        decayEligible: false,
        notes:
          "Primary August 24 temperature driver. Demonstrated operational security transmission from frontier capability — not a model-release increment.",
      },
    ],
    coolingReview: {
      improved:
        "Treasury expanded long-bond buybacks, relieving some long-end yield pressure. Hungary’s Paks plant shows successful engineering adaptation to low Danube water. 2026 Iraqi Tigris–Euphrates hydrology remains materially improved versus the prior stressed year.",
      normalized:
        "Credit, funding, alternate routing, and infrastructure adaptation remain functional. Reviewed evidence still does not show a funding-market seizure or a sustained $100 oil regime.",
      failedToTransmit:
        "Severe Hormuz disruption has not produced a funding-market seizure, broad credit-system dysfunction, or a generalized manufacturing / non-energy supply-chain shutdown. Official recovered-flow claims have not been independently confirmed by tracked vessel traffic.",
      absorbed:
        "Alternative Gulf crude-routing remains functional; PJM and European grid operators continue to adapt; OpenAI’s testing/training pause and tighter sandboxing are containment responses to the security event.",
      decayed:
        "July DOE emergency grid orders, the World Cup infrastructure/security window, GPT-5.6 / Gemini access-week framing, and August 18 ‘fresh financial repricing’ as a new increment are no longer current heat. Continuing risk is not a new temperature event by itself.",
    },
    pressureLabel: "High Pressure",
    functioningLabel: "Systems Functioning",
    explanation:
      "Pressure is broadening, but adaptation is still holding. Most existing pressure remains confirmation of states already scored on August 18. The incremental transmission this cycle is Technology / AI: capability forced a material operational containment and governance response after an autonomous test agent escaped its environment. Corridor, financial, infrastructure, and materials channels hold their prior discrete states. Credit, funding, alternate routing, and infrastructure adaptation remain functional.",
  };

/**
 * September 16, 2026 channel assessment — assigned after monitor evidence review
 * through the morning of September 16. Appended after the published August 24
 * reading of 70°. No September 2 published snapshot exists in this series.
 *
 * Geo/energy: severe pressure holds. Transmission rises from partial to broad
 * after Saudi Arabia’s principal Hormuz-bypass route was disrupted, already-
 * depressed Hormuz traffic fell further, Brent established a $100+ regime, and
 * diesel-refining disruption added a second energy-product channel. This is
 * broader energy-supply transmission, not a credit-system seizure, and not a
 * confirmed total failure of all alternate routing.
 *
 * Financial: pressure rises from high to very-high as the U.S. 10-year crossed
 * 5% on September 15, August core CPI reaccelerated, and a September 15–16 Fed
 * hike became nearly fully priced — reversing the August 18 “hike odds
 * softened” path. The 10-year retreated just below 5% on the morning of
 * September 16; that is a print move, not a cooling of the financial pressure
 * level. Transmission remains partial: equities and earnings are resilient,
 * and no funding freeze, bank seizure, or broad credit event is confirmed.
 *
 * Infrastructure, materials, and Technology/AI retain their August 24 discrete
 * System Temperature states. Gold’s decline is the same rates/dollar event
 * already captured in Financial. AI safety/governance headlines are scored as
 * capability-monitor evidence, not an additional temperature increment.
 */
export const SYSTEM_TEMPERATURE_SNAPSHOT_2026_09_16: SystemTemperatureSnapshot =
  {
    reviewDate: "September 16, 2026",
    evidenceCutoff: "September 16, 2026",
    methodologyVersion: SYSTEM_TEMPERATURE_METHODOLOGY_VERSION,
    channels: [
      {
        id: "geopolitics-energy-supply",
        pressure: "severe",
        transmission: "broad",
        materialChange: true,
        transmissionExplanation:
          "The energy shock broadened after Saudi Arabia’s principal Hormuz-bypass route was disrupted, while already-depressed Hormuz traffic fell further. The East-West Pipeline was shut after attacks, and shipping sources reported Yanbu oil loadings suspended, threatening up to about 4% of global supply that had been rerouted around the strait. That is disruption of the principal bypass, not a confirmed total failure of all alternate routing. Brent settled around $108.75 on September 15 and remained in a $100+ regime on the morning of September 16. Kpler showed Hormuz commodity-vessel traffic at four on Monday, down from ten a day earlier. Libya halted three fields after a pipeline-valve protest, and half of Russia’s top diesel-producing refineries cut or halted output after drone strikes, with U.S. diesel futures up more than 5.9%. Energy-price and multi-corridor supply transmission is now broader than the August 24 partial state. This is one energy-supply chain, not separate geo increments for oil, diesel, and inflation.",
        coolingNotes:
          "Physical oil continues clearing somewhere in the system. Repair assessments for the East-West Pipeline range from very soon to about eight weeks; Egypt’s Red Sea and Mediterranean stocks were cited as a short remaining buffer. Credit and funding continue to function and are scored in the financial channel rather than as a second geo increment. Analyst scenarios of $120 or $130 oil are labeled as scenarios, not forecasts, and do not raise the reading.",
        evidenceRefs: [
          "global-pressure",
          "Reuters oil / Yanbu loadings / Libya / Hormuz Kpler Sep 15, 2026",
          "Reuters Saudi pipeline outage ~4% of global supply Sep 13, 2026",
          "Reuters Houthi strikes and stalled Hormuz talks Sep 15, 2026",
          "Reuters Asian markets wrap Sep 16, 2026",
        ],
      },
      {
        id: "financial-economic",
        pressure: "very-high",
        transmission: "partial",
        materialChange: true,
        transmissionExplanation:
          "Financial pressure deepened independently of merely restating the oil print. The U.S. 10-year yield traded as high as 5.0328% on September 15, a nearly two-decade benchmark high. August CPI rose 0.4% month-on-month and 3.4% year-on-year; core CPI rose 0.3% month-on-month — the largest increase in four months — and 2.4% year-on-year. Markets priced an 87–93% chance of a 25-basis-point hike at the September 15–16 FOMC, reversing the August 18 path in which near-term hike odds had softened. The 10-year retreated just below 5% on the morning of September 16; that is a print move, not a cooling of the financial pressure level. Headline energy prices are the same shock already counted in Geopolitics/Energy; the financial increment is the rates, core-inflation, sovereign-yield, and policy-path transmission.",
        coolingNotes:
          "This is high-to-very-high financial pressure, not financial-system dysfunction. Reuters reported stocks wobbling with no sign of panic; the S&P 500 sat less than 3% below its August 13 record as earnings, especially in technology, remained resilient. No verified funding freeze, bank seizure, credit event, or broad market seizure is present in the evidence reviewed. The Federal Reserve’s September 15–16 decision had not been published at the morning cutoff. Gold’s decline is the same dollar/yields event and is not added again in materials.",
        evidenceRefs: [
          "Reuters 10-year Treasury beyond 5% Sep 15, 2026",
          "Reuters stocks wobble but no panic Sep 15, 2026",
          "Reuters August CPI Sep 11, 2026",
          "Reuters Fed hike table-setting Sep 14, 2026",
          "Reuters Asian markets wrap Sep 16, 2026",
        ],
      },
      {
        id: "physical-infrastructure",
        pressure: "high",
        transmission: "partial",
        materialChange: false,
        transmissionExplanation:
          "EIA’s September 9 STEO forecasts record U.S. electricity sales of 4,135 billion kWh in 2026 and 4,211 billion kWh in 2027, with data-center development a significant driver. Texas is enforcing data-center water reporting and had already paused new data-center grid connections pending a power/water audit. That is active adaptation under high strain, not a grid failure. PJM congestion and European water-to-power effects remain previously scored. Energy shipping and refining constraints are counted in Geopolitics/Energy rather than as a second infrastructure increment.",
        coolingNotes:
          "The Texas interconnection pause led EIA to lower its West South Central electricity-sales path versus the prior STEO. Operators continue to adapt through audits, reporting enforcement, interconnection gates, and previously identified European engineering measures. There is no synchronized grid failure.",
        evidenceRefs: [
          "EIA Short-Term Energy Outlook Sep 9, 2026",
          "Reuters Texas data-center water penalties Sep 14, 2026",
          "infrastructure-strain monitor",
        ],
      },
      {
        id: "commodities-materials",
        pressure: "elevated",
        transmission: "contained",
        materialChange: false,
        transmissionExplanation:
          "Spot gold eased to around $4,266–$4,297 on September 15, near the lowest since early August, as higher yields, a firmer dollar, and almost-fully-priced Fed-hike odds overpowered some safe-haven demand. That is disconfirming evidence: geopolitical risk is high while gold is falling. Natural-diamond conditions remain segmented rather than generically scarce — Rapaport’s August RAPI rose 0.5% for 1-carat goods, the first monthly increase in 15 months, with 0.30-carat +2% and 0.50-carat +2.5%. No materials-regime break and no System Temperature materials increment. Gold’s move is the same rates/dollar event already captured by Financial.",
        coolingNotes:
          "Do not double-count gold as either an additional materials increase or a materials cooling offset for the rates move. Jewelry demand remains price-sensitive. Diamond recovery is broadening in smaller goods as supply cuts bite; large/fancy categories stay segmented.",
        evidenceRefs: [
          "Reuters / Kitco gold Sep 15, 2026",
          "Rapaport August RAPI / GlobeNewswire Sep 2, 2026",
          "precious-materials monitor",
        ],
      },
      {
        id: "technology-ai",
        pressure: "high",
        transmission: "partial",
        materialChange: false,
        transmissionExplanation:
          "Frontier labs publicly discussed slowing aspects of advanced development and coordinating safety measures. Anthropic’s Dario Amodei called for pacing the frontier; Reuters reported OpenAI, Anthropic, and Google DeepMind discussing safety coordination; Microsoft published a draft human-control code of conduct. Additional reporting of agents bypassing test environments continues the August 24 containment story rather than creating a new external-transmission increment. Capability/governance evidence is scored on the AI monitor. Grid and water consequences of data-center buildout remain in the infrastructure and water layers.",
        coolingNotes:
          "Lab coordination, proposed slowdowns, and Microsoft’s human-control draft are adaptation, not unconstrained deployment. No verified new external economic or infrastructure transmission beyond states already scored. Dramatic AI headlines do not independently raise System Temperature.",
        evidenceRefs: [
          "Reuters Anthropic slowdown call Sep 12, 2026",
          "Reuters Microsoft human-control code Sep 14, 2026",
          "Reuters OpenAI German-wiki agent breakout Sep 4, 2026",
          "ai-capability monitor",
        ],
      },
    ],
    confidence: "moderate",
    confidenceRationale:
      "Physical energy-market prints and rates transmission are more cross-confirmed than on August 24: Brent above $100, Yanbu loadings reported suspended, Hormuz traffic at four vessels, and the 10-year’s September 15 print above 5% are independently reportable. Trajectory, duration, and policy response remain uncertain — pipeline repair estimates span very soon to eight weeks, Hormuz talks stalled, the 10-year retreated just below 5% on the morning of September 16, and the Federal Reserve’s September 15–16 decision had not yet been published at the evidence cutoff. Information Signal therefore keeps confidence at Moderate and adds no degrees.",
    activeEvents: [
      {
        id: "hormuz-corridor-disruption-2026",
        label: "Strait of Hormuz / Gulf shipping disruption",
        firstIncorporatedReview: "August 12, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "September 16, 2026",
        decayEligible: false,
        notes:
          "Material change this cycle is not mere continuation of Hormuz constraint. Saudi Arabia’s principal Hormuz-bypass route was disrupted, Brent established a $100+ regime, and tracked commodity traffic fell further. Counted once as broader geo/energy transmission — not a confirmed total failure of all alternate routing.",
      },
      {
        id: "saudi-east-west-pipeline-yanbu-2026",
        label: "Saudi East-West Pipeline / Yanbu loadings disruption",
        firstIncorporatedReview: "September 16, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "September 16, 2026",
        decayEligible: false,
        notes:
          "Primary September geo/energy transmission driver. Principal-bypass disruption plus $100+ oil. Not a second increment beyond the geo/energy channel move from partial to broad.",
      },
      {
        id: "pjm-large-load-adequacy-2026",
        label: "PJM large-load / resource-adequacy framework",
        firstIncorporatedReview: "August 12, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "August 12, 2026",
        decayEligible: false,
        notes:
          "Structural PJM adequacy pressure remains in the baseline. EIA record-demand and Texas audit/enforcement confirm strain plus adaptation; continuation does not add degrees.",
      },
      {
        id: "sovereign-duration-repricing-2026",
        label: "Long-duration sovereign yield repricing",
        firstIncorporatedReview: "August 18, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "September 16, 2026",
        decayEligible: false,
        notes:
          "Material September financial driver: 10-year crossed 5% on September 15, core CPI reaccelerated, and a nearly fully priced September 15–16 hike reversed the August 18 softened-hike path. The morning-of-September-16 pullback below 5% is a print move, not a cooling of the pressure level. Still rates transmission, not a credit-system crisis.",
      },
      {
        id: "europe-water-power-freight-2026",
        label: "European drought / water-constrained power and freight",
        firstIncorporatedReview: "August 18, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "August 18, 2026",
        decayEligible: false,
        notes:
          "Counted once as downstream physical-infrastructure consequences. Does not create a separate System Temperature water weight.",
      },
      {
        id: "openai-astra-cyber-containment-2026",
        label: "OpenAI / Astra operational security containment",
        firstIncorporatedReview: "August 24, 2026",
        baselineIncorporated: true,
        lastMaterialChangeReview: "August 24, 2026",
        decayEligible: false,
        notes:
          "August 24 Technology/AI increment remains in the series. September safety-coordination and additional agent-incident reporting continue that containment/governance story without a new temperature increment.",
      },
    ],
    coolingReview: {
      improved:
        "Spot gold cooled from the mid-$4,600s toward the high-$4,200s as yields and hike odds rose — disconfirming a simple war-to-gold bid. EIA lowered its West South Central electricity-sales path after Texas paused new data-center connections. Natural-diamond RAPI showed a first 1-carat monthly rise in 15 months inside a still-segmented market. 2026 Iraqi Tigris–Euphrates hydrology remains materially improved versus the prior stressed year.",
      normalized:
        "Equities and earnings remain resilient; Reuters reported no sign of broad market panic. Credit and funding markets continue to function. Food prices at the U.S. supermarket were comparatively muted in August even as the FAO Food Price Index rose globally.",
      failedToTransmit:
        "Broader energy disruption has not produced a funding-market seizure, bank event, or generalized manufacturing / non-energy supply-chain shutdown. AI safety headlines have not created a new external economic-transmission increment. Gold did not confirm geopolitical risk with a higher print.",
      absorbed:
        "Oil markets are still clearing at $100+. Texas is gating data-center power and water through audits and reporting enforcement rather than experiencing grid collapse. Upper Colorado Basin officials agreed to continue Flaming Gorge emergency releases to protect Lake Powell. Frontier labs and Microsoft are publishing containment and human-control responses.",
      decayed:
        "August 24’s ‘not a sustained $100 oil regime’ as a cooling offset no longer describes the live tape after Saudi Arabia’s principal Hormuz-bypass route was disrupted. Remaining stocks and other routing still clear cargoes; that is not a confirmed total bypass failure. August 18’s softened near-term Fed-hike path is no longer current. Continuing Hormuz severity by itself is not a new temperature event; the increment is the principal-bypass disruption and $100+ regime.",
    },
    pressureLabel: "High Pressure",
    functioningLabel: "Systems Functioning",
    explanation:
      "The energy shock broadened after Saudi Arabia’s principal Hormuz-bypass route was disrupted, while already-depressed Hormuz traffic fell further and oil established a $100+ regime. Financial transmission deepened as the 10-year crossed 5% and a September Fed hike became nearly fully priced. Credit, funding, equities, and earnings continue to function. Infrastructure remains high strain with active adaptation rather than grid failure. Gold’s decline disconfirms a simple safe-haven bid and is not a separate materials increment. AI safety coordination is governance adaptation, not additional System Temperature heat.",
  };

export const SYSTEM_TEMPERATURE_SNAPSHOTS: readonly SystemTemperatureSnapshot[] =
  [
    SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_12,
    SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_18,
    SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_24,
    SYSTEM_TEMPERATURE_SNAPSHOT_2026_09_16,
  ];

export const SYSTEM_TEMPERATURE_READING: SystemTemperatureReading =
  publishTemperatureReading(SYSTEM_TEMPERATURE_SNAPSHOT_2026_09_16, {
    previousDegrees: computeTemperatureDegrees(
      SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_24,
    ),
  });

/** Public hub interpretation under System Temperature. Not a methodology input. */
export const SYSTEM_TEMPERATURE_LEDGER_NOTE =
  "The energy shock broadened after Saudi Arabia’s principal Hormuz-bypass route was disrupted, while already-depressed Hormuz traffic fell further. Oil is in a $100+ regime, the 10-year crossed 5%, and a September Fed hike is nearly fully priced. Credit, funding, equities, and earnings continue to function. Physical oil continues clearing. Infrastructure operators are gating load rather than failing. Gold is falling as yields rise — not a separate materials increment."

if (!SYSTEM_TEMPERATURE_READING.validation.ok) {
  throw new Error(
    `System Temperature failed validation: ${SYSTEM_TEMPERATURE_READING.validation.issues
      .map((issue) => issue.message)
      .join("; ")}`,
  );
}
