/**
 * Information Signal Map — weekly data.
 * ARCHIVED NUMERICAL SERIES — public page is qualitative (no proprietary clarity score).
 * ISM_READING remains for rebuild if a reproducible content-analysis methodology is developed.
 * Information Signal sets System Temperature confidence only — it does not add heat.
 */

import {
  LEDGER_EVIDENCE_CUTOFF,
  LEDGER_METHODOLOGY_VERSION,
  defineLedgerMonitorSeries,
  latestSnapshot,
} from "./ledger-monitor-framework";
import { bufferSourcesFor, bufferSourcesForOctober1 } from "./buffer-health-data";

export const ISM_UPDATED_LABEL = "";

export const ISM_READING = {
  score: 85,
  label: "Signal Clarity",
  status: "High-Attention, Uneven Clarity",
  weeklyChange: 0,
} as const;

export const ISM_SUMMARY =
  "The October 10 evidence stack is sharper: official energy data confirms partial flow recovery alongside depleted inventories; labor data confirms slower payroll momentum alongside low claims; market data shows elevated yields and wider but contained spreads; and first-party AI releases show both broad capability diffusion and active safety controls. These cross-checks improve specificity without eliminating uncertainty. Confidence stays Moderate; Information Signal adds no degrees.";

export const ISM_SIGNAL_GRID = [
  {
    title: "Consensus",
    body: "Energy buffers remain low despite partial flow recovery; long yields remain elevated; credit spreads are wider but contained; payroll momentum weakened while claims stayed low; AI capability and governance both advanced.",
  },
  {
    title: "Divergence",
    body: "Partial oil-flow recovery does not rebuild depleted inventories; weaker payrolls do not equal labor collapse; a higher food-price index does not prove shortage; and broad AI access does not remove security or infrastructure gates.",
  },
  {
    title: "Underweighted",
    body: "The interaction between thin distillate stocks, large-load grid planning, slower labor momentum, and AI diffusion — and the fact that Information Signal still sets confidence only.",
  },
] as const;

export const ISM_SOURCE_STACK = [
  {
    title: "Institutional",
    body: "Emphasizes partial oil-flow recovery alongside depleted inventories, weaker payroll momentum alongside low claims, rising food prices alongside a still-large forecast crop, and the distinction between low reserve capacity and failure.",
  },
  {
    title: "Market",
    body: "Emphasizes the 10-year holding at 5.24%, high-yield spreads widening but remaining contained, and orderly funding — linking rates pressure more tightly to duration than to seizure.",
  },
  {
    title: "Infrastructure",
    body: "Emphasizes strong observed electricity use, large computational loads, standards work, and operator adaptation rather than national grid collapse.",
  },
  {
    title: "Mainstream",
    body: "Emphasizes elevated oil, bond-market headlines, weaker jobs, and GPT-6 launch drama — often compressing distinct energy, labor, rates, and AI stories into one direction.",
  },
] as const;

export const ISM_NARRATIVE_MAP = [
  {
    title: "Domestic Framing",
    body: "Emphasizes fuel costs, borrowing costs, and weaker payroll growth. Tends to underweight low claims, stable unemployment and hours, and the difference between thinner reserve and system failure.",
  },
  {
    title: "Political Framing",
    body: "Emphasizes conflict attribution, sanctions, and control of energy routes. Tends to underweight the partial recovery in production and bypass flows and the time needed to rebuild inventories.",
  },
  {
    title: "Market Framing",
    body: "Emphasizes September Brent averaging $114 and the 10-year holding at 5.24%. Tends to underweight that high-yield spreads remain contained and oil-flow recovery is partial rather than absent.",
  },
  {
    title: "Infrastructure Framing",
    body: "Emphasizes Texas data-center water/power enforcement and EIA record demand. Tends to underweight that those are adaptation gates, not grid failure.",
  },
] as const;

export const ISM_NARRATIVE_SHIFT =
  "Official releases now resolve several October questions with dated evidence: flow recovery is partial, payroll momentum is weaker, credit transmission remains contained, food-price pressure rose without shortage, large-load adaptation is active, and frontier AI access broadened alongside safety controls. The story is more precise, not uniformly cooler. Confidence remains Moderate; Information Signal adds no degrees.";

export const ISM_WHAT_TO_WATCH = [
  {
    title: "Physical-print alignment",
    body: "Whether independently trackable Hormuz transits, Brent, diesel, and long yields continue to tell one physical story.",
  },
  {
    title: "Flow recovery versus inventory repair",
    body: "Whether higher bypass and Hormuz shipments persist long enough to rebuild crude and distillate inventories, rather than being treated as immediate normalization.",
  },
  {
    title: "Labor and credit composition",
    body: "Whether weaker payroll momentum is reported alongside low claims, stable unemployment and hours, and contained spreads instead of as either no problem or confirmed collapse.",
  },
  {
    title: "AI access versus AI controls",
    body: "Whether GPT-6 and Claude deployment is reported alongside system cards, unintended-action evidence, evaluation restrictions, and physical infrastructure gates.",
  },
] as const;

export const ISM_WHAT_WOULD_CHANGE = [
  {
    title: "Information noise reduction",
    body: "Lower headline density and cleaner single-theme reads across policy, markets, and shipping coverage — without implying corridor conditions have eased.",
  },
  {
    title: "Transit-data alignment",
    body: "Closer alignment between official control or flow claims and independently trackable Hormuz transit volumes.",
  },
  {
    title: "Narrative decoupling",
    body: "Energy-corridor stress, long-duration yields, credit conditions, and AI grid constraints discussed as separable storylines with less forced equivalence.",
  },
  {
    title: "Tone moderation",
    body: "More measured cadence across institutional, market, infrastructure, and mainstream sources at the same time.",
  },
] as const;

export const ISM_FOOTER_NOTE =
  "Narrative analysis and framing comparison — observational, without speculation or certainty claims. Information Signal informs confidence in the System Temperature reading; it does not raise the temperature itself.";

export const ISM_CURRENT_STATE = "High-attention / Physical evidence converging";

export const ISM_CURRENT_DIRECTION =
  "Official evidence sharper / Cross-system framing still uneven";

export const ISM_HUB_STATUS = ISM_CURRENT_STATE;

export const ISM_HUB_DESCRIPTION =
  "High-attention / Physical evidence converging — official October releases sharpen the evidence while cross-system framing remains uneven.";

/** Append-only public series. Future reviews push a new snapshot. */
export const ISM_SERIES = defineLedgerMonitorSeries({
  id: "information-signal-map",
  methodologyVersion: LEDGER_METHODOLOGY_VERSION,
  definition:
    "Maps narrative convergence, divergence, and evidence quality across institutional, market, infrastructure, and mainstream information layers.",
  snapshots: [
    {
      reviewDate: "August 3, 2026",
      evidenceCutoff: "August 3, 2026",
      currentState: "High-attention / Uneven clarity",
      currentDirection: "More signals, no corresponding increase in clarity.",
      previousState: "High-Attention, Uneven Clarity (archived numerical series)",
      materialChangeSummary:
        "Signal density rose around corridor enforcement and frontier AI access claims without a corresponding increase in clarity.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "U.S. Central Command / maritime security reporting",
          title: "Public military framing of Red Sea and corridor operations",
          date: "Reviewed through August 3, 2026",
          supports:
            "Official military framing competing with physical shipping evidence in the same cycle",
        },
      ],
    },
    {
      reviewDate: "August 12, 2026",
      evidenceCutoff: "August 12, 2026",
      currentState: "High-attention / Uneven clarity",
      currentDirection: "More conflicting corridor claims; no clarity improvement.",
      previousState: "High-attention / Uneven clarity",
      materialChangeSummary:
        "Hormuz reopen optimism faded while recovered-flow claims diverged from vessel-tracking counts; OpenAI’s August ChatGPT updates added another qualified-access storyline without improving overall clarity.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "Reuters",
          title:
            "Hormuz shipping traffic falls to one-week low amid hostilities",
          date: "August 12, 2026",
          url: "https://www.reuters.com/business/energy/hormuz-shipping-traffic-falls-one-week-low-amid-hostilities-2026-08-12/",
          supports:
            "Competing reopen/hostility framing beside Kpler/LSEG transit prints far below pre-conflict norms",
        },
        {
          institution: "Reuters",
          title:
            "Oil rises as doubts over US-Iran deal heighten supply concerns",
          date: "August 12, 2026",
          url: "https://www.reuters.com/business/energy/oil-rises-as-doubts-over-us-iran-deal-heighten-supply-concerns-2026-08-12/",
          supports:
            "Oil near $89 told beside maritime-attack and negotiation-deadlock headlines in the same cycle",
        },
        {
          institution: "OpenAI",
          title:
            "Improving GPT-5.6 Sol in ChatGPT—and expanding access to GPT-5.6 Luna for free users",
          date: "August 6, 2026",
          url: "https://openai.com/index/improving-gpt-5-6-sol-in-chatgpt/",
          supports:
            "Consumer ChatGPT updates distinct from Work/Codex model versions in the same product family",
        },
        {
          institution: "PJM Interconnection",
          title: "Interim Resource Adequacy / large-load framework materials",
          date: "Reviewed through August 12, 2026",
          url: "https://www.pjm.com/-/media/DotCom/about-pjm/who-we-are/public-disclosures/2026/20260727-cifp-framework-for-service-during-periods-of-insufficient-resource-adequacy-executive-summary.pdf",
          supports:
            "Infrastructure narrative shifting from expired July emergency windows to structural large-load adequacy",
        },
      ],
    },
    {
      reviewDate: "August 18, 2026",
      evidenceCutoff: "August 18, 2026",
      currentState: "High-attention / Uneven clarity",
      currentDirection: "Physical evidence clearer; strategic intent more uncertain.",
      previousState: "High-attention / Uneven clarity",
      materialChangeSummary:
        "Physical evidence (shipping counts, Brent above $90, expired talks, long yields, European water-to-power effects) became clearer while strategic intent, Hormuz-control language, Oman’s role, and the diplomatic path remained more uncertain. Confidence stays Moderate; Information Signal still adds no degrees.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "Marine Link / Reuters",
          title: "No US-Iran Talks Planned, Hormuz Remains Closed",
          date: "August 18, 2026",
          url: "https://www.marinelink.com/news/usiran-talks-planned-hormuz-remains-542205",
          supports:
            "Physical shipping still in single digits and Brent above $90 beside contested Hormuz-open/closed and diplomatic-path language",
        },
        {
          institution: "CNBC",
          title: "30-year Treasury yield hits 19-year high",
          date: "August 18, 2026",
          url: "https://www.cnbc.com/2026/08/18/treasury-yields-.html",
          supports:
            "Observable long-duration Treasury and G10 yield repricing becoming a clearer market fact than diplomatic intent",
        },
        {
          institution: "BBC News",
          title:
            "Romania shuts only nuclear plant as heat causes drop in Danube River level",
          date: "August 13–14, 2026 (reviewed August 18, 2026)",
          url: "https://www.bbc.com/news/articles/cqlxpq5q799o",
          supports:
            "European physical-infrastructure effects independently reportable rather than purely narrative",
        },
      ],
    },
    {
      reviewDate: "August 24, 2026",
      evidenceCutoff: "August 24, 2026",
      currentState: "High-attention / Uneven clarity",
      currentDirection: "Physical evidence strengthening / Official narratives diverging further",
      previousState: "High-attention / Uneven clarity",
      materialChangeSummary:
        "Major divergence between official Hormuz crude-flow claims and independently trackable shipping/flow estimates; tracked vessel traffic remains extremely depressed. Asian refined-product shortages are a clearer transmitted consequence than the headline crude-volume dispute. Treasury buybacks can be framed as liquidity support or fiscal/dollar concern. AI narrative now contains both rapid capability progress and a developer-imposed security slowdown. Confidence stays Moderate; Information Signal adds no degrees.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "Reuters",
          title:
            "Fewer than 20 ships transit key Strait of Hormuz over weekend, data shows",
          date: "August 24, 2026",
          url: "https://www.thehindu.com/news/international/fewer-than-20-ships-transit-key-strait-of-hormuz-over-weekend-data-shows/article71383056.ece",
          supports:
            "Independently trackable weekend Hormuz transit still below 20; UKMTO AIS about 90% below pre-conflict baselines beside official recovered-flow claims",
        },
        {
          institution: "U.S. Department of the Treasury",
          title:
            "Treasury Announces Increased Sizes of Nominal Long-End Liquidity Support Buybacks Beginning September 9",
          date: "August 19, 2026 (reviewed August 24, 2026)",
          url: "https://home.treasury.gov/news/press-releases/sb0607",
          supports:
            "Official long-end buyback expansion that can be framed as liquidity support or as evidence of fiscal/dollar concern",
        },
        {
          institution: "OpenAI",
          title: "Pacing model development in an era of cyber-critical capabilities",
          date: "August 19, 2026 (reviewed August 24, 2026)",
          url: "https://openai.com/index/pacing-model-development-cyber-capabilities/",
          supports:
            "AI narrative now containing both rapid capability progress and an actual developer-imposed security slowdown after the Hugging Face incident and Astra cyber-threshold review",
        },
      ],
    },
    {
      reviewDate: "September 16, 2026",
      evidenceCutoff: "September 16, 2026",
      currentState: ISM_CURRENT_STATE,
      currentDirection: ISM_CURRENT_DIRECTION,
      previousState: "High-attention / Uneven clarity",
      materialChangeSummary:
        "Physical energy-market and rates evidence is now more cross-confirmed than on August 24: Brent in a $100+ regime, Hormuz commodity traffic at four vessels, Saudi Arabia’s principal Hormuz-bypass route disrupted, and the U.S. 10-year crossed 5% on September 15. Duration, repair timeline, and the September 15–16 Fed outcome remain uncertain. Gold’s decline is a material disconfirmation. Confidence stays Moderate; Information Signal adds no degrees.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        {
          institution: "Reuters",
          title:
            "Oil jumps nearly $3 as Saudi export halt, Libya outages stoke supply fears",
          date: "September 15, 2026",
          url: "https://www.reuters.com/business/energy/oil-prices-rise-saudi-pipeline-outage-fresh-attacks-raise-supply-concerns-2026-09-15/",
          supports:
            "Independently trackable $100+ oil, Yanbu loading suspension, Hormuz traffic at four vessels, and diesel-refinery disruption as a clearer physical story than diplomatic intent",
        },
        {
          institution: "Reuters",
          title:
            "Bond selloff drives US benchmark beyond 5%; stocks rattled",
          date: "September 15, 2026",
          url: "https://www.reuters.com/world/asia-pacific/bond-selloff-drives-us-benchmark-beyond-5-stocks-rattled-2026-09-15/",
          supports:
            "10-year yield crossed 5% on September 15 as a cross-confirmed market fact beside still-unsettled pipeline duration and Fed outcome",
        },
        {
          institution: "Reuters",
          title: "Stocks wobble but no sign of panic as yields surge",
          date: "September 15, 2026",
          url: "https://www.reuters.com/business/finance/stocks-wobble-no-sign-panic-yields-surge-2026-09-15/",
          supports:
            "Equity and earnings resilience as disconfirmation of a financial-crisis narrative despite the rates move",
        },
        {
          institution: "Reuters / Kitco",
          title: "Gold eases on stronger US rate hike odds",
          date: "September 15, 2026",
          url: "http://www.kitco.com/news/off-the-wire/2026-09-15/gold-eases-stronger-us-rate-hike-odds",
          supports:
            "Spot gold near the lowest since early August while geopolitical risk is high — a material disconfirmation of a simple safe-haven frame",
        },
      ],
    },
    {
      reviewDate: "October 1, 2026",
      evidenceCutoff: "October 1, 2026",
      currentState: ISM_CURRENT_STATE,
      currentDirection: ISM_CURRENT_DIRECTION,
      previousState: "High-attention / Physical evidence converging",
      materialChangeSummary:
        "Observed Yanbu / East-West restoration and the realized Fed hike resolve two September uncertainties. Estimated energy depletion, provisional product inventories, forecast grid and food balances, lagged stress, and observed market and labor evidence remain explicitly separated. Confidence stays Moderate; Information Signal adds no degrees.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: bufferSourcesForOctober1("energy", "financial-system", "labor", "grid", "food"),
    },
    {
      reviewDate: LEDGER_EVIDENCE_CUTOFF,
      evidenceCutoff: LEDGER_EVIDENCE_CUTOFF,
      currentState: ISM_CURRENT_STATE,
      currentDirection: ISM_CURRENT_DIRECTION,
      previousState: "High-attention / Physical evidence converging",
      materialChangeSummary:
        "Official October releases sharpen the distinction between pressure and failure: energy flows partially recovered while inventories remained depleted; payroll momentum weakened while claims stayed low; yields stayed elevated and spreads contained; food prices rose without verified shortage; large-load standards advanced; and AI access broadened alongside published safeguards. Confidence remains Moderate and Information Signal adds no degrees.",
      methodologyVersion: LEDGER_METHODOLOGY_VERSION,
      sources: [
        ...bufferSourcesFor("energy", "financial-system", "labor", "grid", "food"),
        {
          institution: "OpenAI",
          title: "GPT-6 for everyone",
          date: "October 7, 2026",
          url: "https://openai.com/index/gpt-6-for-everyone/",
          supports:
            "First-party confirmation of broad GPT-6 access and new product surfaces.",
        },
        {
          institution: "Anthropic",
          title: "Investigating unintended model actions",
          date: "October 9, 2026",
          url: "https://www.anthropic.com/research/investigating-unintended-model-actions",
          supports:
            "First-party evidence of unintended actions and tighter evaluation controls, counterbalancing simple capability-only framing.",
        },
      ],
    },
  ],
});

export const ISM_SNAPSHOT = latestSnapshot(ISM_SERIES);
