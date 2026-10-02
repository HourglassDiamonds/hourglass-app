# Ledger Automation V1.1 — live adapters and dry-run validation

Ledger Automation remains `APPROVAL_ONLY`. V1.1 adds an explicit internal live dry run; it does not schedule, publish, mutate public Ledger data, or change the October 1, 2026 baseline. The existing authenticated cron service remains on the V1 approved-snapshot adapter. Live credential egress occurs only when an operator explicitly runs `npm run ledger:dry-run`.

## Source audit and decisions

The V1 registry is a deterministic replay of the October 1 evidence. Reused sources appear under multiple monitor IDs; the table groups those duplicates by underlying source.

| Monitor(s) | Current source | Proposed live source | Authority / access | Cadence | Freshness SLA | Credential | V1.1 | Reason |
|---|---|---|---|---|---:|---|---|---|
| Households | BEA Personal Income and Outlays | BEA NIPA API | BEA JSON API | Monthly | 45d | `BEA_API_KEY` | Live | Direct official structured observations |
| Households | NY Fed Household Debt and Credit | Same report | NY Fed report/download | Quarterly | 120d | — | Manual | Multi-table interpretation |
| Labor; GPI; AI; Infrastructure; Information | BLS Employment Situation | BLS Public Data API | BLS JSON API | Monthly | 45d | — | Live | Official series; no-key public access |
| Same | BLS JOLTS | BLS Public Data API | BLS JSON API | Monthly | 45d | — | Live | Official series; no-key public access |
| Same | DOL Weekly Claims | Same publication | DOL PDF | Weekly | 14d | — | Manual | No stable narrow JSON equivalent verified |
| Food; GPI; Water; Information | USDA NASS Grain Stocks | Quick Stats considered | USDA API | Quarterly | 120d | USDA key | Manual | Multi-commodity query and interpretation |
| Same | USDA ERS Rice Outlook | Same report | USDA narrative | Monthly | 60d | — | Manual | Forecast narrative |
| Same | FAO Cereal Supply and Demand | Same brief | FAO publication/API considered | Monthly | 60d | — | Manual | Multi-balance interpretation; new API is not a drop-in equivalent |
| Same | FAO fertilizer statement | Same statement | FAO narrative | Irregular | Manual | — | Manual | Qualitative Tier 3 evidence |
| Energy; GPI; Information | IEA Oil Market Report | Same report | IEA report/data | Monthly | 45d | Licensed access | Manual | No paid dependency authorized |
| Same | EIA Weekly Petroleum Status | EIA Open Data v2 | EIA JSON API | Weekly | 14d | `EIA_API_KEY` | Live | Official structured observations |
| Same | EIA STEO | EIA Open Data v2 | EIA JSON API | Monthly | 45d | `EIA_API_KEY` | Live | Forecast remains explicitly manual-review |
| Same | Seatrade Yanbu report | Same report | Trade publication | Event | Manual | — | Manual | Narrative third-party evidence; no scraping |
| Grid; GPI; AI; Infrastructure; Information | NERC Summer Reliability Assessment | Same assessment | NERC PDF | Seasonal | 180d | — | Manual | Planning study requires context |
| Same | DOE Carolinas emergency notice | Same notice | DOE publication | Event | Manual | — | Manual | Event semantics are not safely inferred |
| Same | EIA electricity outlook | EIA Open Data v2 | EIA JSON API | Daily/monthly | 14d | `EIA_API_KEY` | Live | Official load/generation observation |
| Financial; GPI; Precious Materials; Information | Treasury yield curve | Treasury XML feed | Treasury XML API | Business daily | 7d | — | Live | Direct official feed |
| Same | ICE BofA HY OAS | FRED observations | St. Louis Fed JSON API | Business daily | 7d | `FRED_API_KEY` | Live | Exact approved series only |
| Same | St. Louis Fed Financial Stress | FRED observations | St. Louis Fed JSON API | Weekly | 14d | `FRED_API_KEY` | Live | Exact approved series only |
| Same | NY Fed repo/reverse repo | Markets Data API considered | NY Fed | Business daily | 7d | — | Manual | “Orderly funding” requires multi-field context |
| Precious Materials | Rapaport diamond-price release | Same release | Trade publication | Monthly | Manual | — | Manual | No stable authoritative free structured equivalent |
| Precious Materials | De Beers interim results | Same release | Issuer report | Semiannual | Manual | — | Manual | Narrative corporate disclosure |
| Global Water Stress | Current food-buffer evidence | NOAA/NIDIS considered | Official JSON, U.S.-only | Weekly | 14d | — | Manual | U.S.-only drought data would redefine a global monitor |
| AI Capability Acceleration | Current grid/labor evidence | Official system cards considered | Curated publications | Event | Manual | — | Manual | No durable cross-provider capability schema |
| Information Signal Map | Current mixed evidence | Official advisories considered | Mixed | Mixed | Manual | Mixed | No single factual feed preserves the current narrative model |

## Adapter contract and failure behavior

Every check records identity, authority and fixed source URL; observation and fetch timestamps; raw and normalized values; unit; freshness; confidence; status; failure reason; and bounded metadata. Registry modes are `LIVE`, `MANUAL_APPROVED`, `DERIVED`, and `DISABLED`.

Statuses are `OK`, `STALE`, `UNAVAILABLE`, `INVALID`, `RATE_LIMITED`, `AUTH_REQUIRED`, and `MANUAL_REVIEW_REQUIRED`. Missing, malformed, stale, unauthorized, and rate-limited data are never converted to neutral observations. Required failures fail the run; optional failures remain explicit and force approval review.

Requests use fixed HTTPS provider endpoints, an identifying user agent, an 8-second default timeout, at most two attempts, content-type and schema checks, a 1 MB response limit, explicit timestamps, numeric/unit validation, and per-run provider request deduplication. There is no arbitrary-URL adapter or proxy.

## Normalization

V1.1 deliberately does not add thresholds. Successful live responses are normalized only into a stable observation envelope. They do not propose monitor states, Buffer Health states, or temperature channels. Their status is `MANUAL_REVIEW_REQUIRED`, and the evidence packet is `APPROVAL_REQUIRED`. This preserves the October 1 methodology and readings.

## Configuration

All keys are free provider credentials and server-side only:

- `BEA_API_KEY` — BEA Data API user key.
- `EIA_API_KEY` — EIA Open Data v2 key.
- `FRED_API_KEY` — FRED API key.

Missing keys produce `AUTH_REQUIRED`; keys are removed from recorded URLs and never logged. BLS and Treasury require no key. No paid service is enabled.

## Dry run

Run a Tuesday full review:

```sh
npm run ledger:dry-run
```

Run the Friday delta path explicitly:

```sh
npm run ledger:dry-run -- --friday
```

The command prints source health, live/manual counts, stale and unavailable sources, monitor and Buffer Health proposals, proposed overall state, approval classification, and a local evidence-packet path. Local packets are written only to `.tmp/ledger-dry-runs/`; Blob persistence is not attempted and no production fallback is created.

Founder review is still required for every live interpretation, all retained manual sources, conflicting observations, and every proposed public change.
