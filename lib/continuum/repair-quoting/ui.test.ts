import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { RepairQuoteDetail, RepairQuotesSection } from "../../../app/executive-dashboard/concierge/components/repair-quote-view";
import { OperatingLayerOverview } from "../../../app/executive-dashboard/concierge/components/operating-layer-page";
import { emptyRepairDetails } from "@/lib/continuum/client-memory/project-operating/fields";
import { activeOperatingLayer } from "@/lib/continuum/client-memory/project-operating/layer";
import {
  REPAIR_QUOTE_ADD_LABEL,
  REPAIR_QUOTES_NONE_LABEL,
  STALE_GOLD_WARNING,
  repairQuoteDisplayTitle,
} from "./present";
import type { RepairQuote } from "./types";

const PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const QUOTE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function quote(extra: Partial<RepairQuote> = {}): RepairQuote {
  return {
    quoteId: QUOTE_ID,
    projectId: PROJECT_ID,
    quoteNumber: 3,
    state: "draft",
    repairType: "sizing",
    metalFamily: "gold_14k",
    associatedPersonId: null,
    sourceEditionLabel: "Founder-transcribed Blue Book line",
    sourcePriceSemantics: "shop_cost",
    goldUsdCentsPerTroyOz: 440_000,
    goldAsOfDate: "2026-09-09",
    goldInputSource: "founder_manual",
    goldBaselineUsdCentsPerTroyOz: 300_000,
    markupRatioPermyriad: 25_000,
    lines: [
      {
        sourceLineRef: "SZ-14K-UP",
        sourceLineLabel: "Size 14K ring up one half size",
        sourceAmountCents: 12_000,
        goldSensitive: true,
        goldWeightKind: "alloy_dwt",
        goldWeightMillidwt: 2_500,
        fineGoldMillidwt: 1458,
        metalDeltaCents: 10_206,
        adjustedSourceCents: 22_206,
      },
    ],
    calculation: {
      sourceFamily: "founder_transcribed_blue_book",
      sourceEditionLabel: "Founder-transcribed Blue Book line",
      sourcePriceSemantics: "shop_cost",
      goldUsdCentsPerTroyOz: 440_000,
      goldAsOfDate: "2026-09-09",
      goldInputSource: "founder_manual",
      goldBaselineUsdCentsPerTroyOz: 300_000,
      markupRatioPermyriad: 25_000,
      lines: [],
      sourceAmountTotalCents: 12_000,
      metalDeltaTotalCents: 10_206,
      adjustedSourceTotalCents: 22_206,
      computedHourglassQuoteCents: 55_515,
      hourglassQuoteCents: 55_515,
      overrideApplied: false,
      warnings: [],
    },
    override: null,
    issuedAt: null,
    issuedBy: null,
    voidedAt: null,
    voidedBy: null,
    createdAt: "2026-09-09T16:00:00.000Z",
    updatedAt: "2026-09-09T16:00:00.000Z",
    createdBy: "justin",
    createdMutationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    issuedMutationId: null,
    ...extra,
  };
}

describe("Repair quote UI", () => {
  it("lists quotes by number and type, not raw UUIDs", () => {
    const html = renderToStaticMarkup(
      createElement(RepairQuotesSection, {
        projectId: PROJECT_ID,
        quotes: [quote()],
        connected: true,
      }),
    );
    assert.match(html, /Quote 3 · Sizing/);
    assert.match(html, new RegExp(REPAIR_QUOTE_ADD_LABEL));
    assert.doesNotMatch(html, /Quote ID|quoteId/);
    const empty = renderToStaticMarkup(
      createElement(RepairQuotesSection, {
        projectId: PROJECT_ID,
        quotes: [],
        connected: true,
      }),
    );
    assert.match(empty, new RegExp(REPAIR_QUOTES_NONE_LABEL));
  });

  it("distinguishes shop cost, gold, markup, and Hourglass quote", () => {
    const html = renderToStaticMarkup(
      createElement(RepairQuoteDetail, {
        quote: quote({
          calculation: {
            ...quote().calculation,
            warnings: ["stale-gold"],
          },
        }),
        projectTitle: "Wagner repair",
        personName: "Ada Lovelace",
      }),
    );
    assert.match(html, /Ada Lovelace/);
    assert.match(html, /Wagner repair/);
    assert.match(html, /Shop cost/);
    assert.match(html, /Source amount/);
    assert.match(html, /Metal delta/);
    assert.match(html, /Hourglass quote/);
    assert.match(html, /2\.5×/);
    assert.match(html, new RegExp(STALE_GOLD_WARNING));
    assert.doesNotMatch(html, new RegExp(QUOTE_ID));
    assert.equal(repairQuoteDisplayTitle(quote()), "Quote 3 · Sizing");
  });

  it("exposes repair quotes from the Repair operating layer, not a public calculator", () => {
    const layer = activeOperatingLayer({
      projectKind: "repair_service",
      repairDetails: emptyRepairDetails(PROJECT_ID, "2026-09-09T00:00:00.000Z"),
    });
    assert.equal(layer.kind, "repair_service");
    if (layer.kind !== "repair_service") return;
    const html = renderToStaticMarkup(
      createElement(OperatingLayerOverview, {
        projectId: PROJECT_ID,
        projectTitle: "Wagner repair",
        layer,
      }),
    );
    assert.match(html, /Repair quotes/);
    assert.match(
      html,
      /\/executive-dashboard\/concierge\/projects\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/repair\/quotes/,
    );
    assert.doesNotMatch(html, /public calculator|customer quote widget/i);
  });
});
