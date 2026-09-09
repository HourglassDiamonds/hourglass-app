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
  repairQuoteDisplayTitle,
} from "./present";
import { GELLER_BLUE_BOOK } from "./contract";
import { lookupVerifiedSku } from "./source";
import type { RepairQuote } from "./types";

const PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const QUOTE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function quote(extra: Partial<RepairQuote> = {}): RepairQuote {
  const verified = lookupVerifiedSku("1000");
  assert.ok(verified);
  const loadedLaborEighthCents = 16_000;
  const rawComputedQuoteEighthCents = 40_000;
  const line = {
    sku: verified.sku,
    taskDescription: verified.taskDescription,
    amounts: verified.amounts,
    metalBand: verified.metalBand,
    hasExplicitMetalQuantity: verified.hasExplicitMetalQuantity,
    loadedLaborEighthCents,
    partsCostEighthCents: 0,
    otherCostEighthCents: 0,
    fullyLoadedDirectCostEighthCents: loadedLaborEighthCents,
  };
  return {
    quoteId: QUOTE_ID,
    projectId: PROJECT_ID,
    quoteNumber: 3,
    state: "draft",
    repairType: verified.repairType,
    metalFamily: verified.metalFamily,
    associatedPersonId: null,
    sourceEditionLabel: GELLER_BLUE_BOOK.editionLabel,
    sourceSku: verified.sku,
    line,
    calculation: {
      sourceFamily: "geller_blue_book",
      sourceVersion: "5.0",
      sourceRelease: "6.50",
      sourceEditionLabel: GELLER_BLUE_BOOK.editionLabel,
      sourceSku: verified.sku,
      sourceTaskDescription: verified.taskDescription,
      sourceAmounts: verified.amounts,
      laborBurdenNumerator: 5,
      laborBurdenDenominator: 4,
      hourglassMarkupNumerator: 5,
      hourglassMarkupDenominator: 2,
      metalBand: null,
      expressSelected: false,
      line,
      loadedLaborEighthCents,
      partsCostEighthCents: 0,
      otherCostEighthCents: 0,
      fullyLoadedDirectCostEighthCents: loadedLaborEighthCents,
      rawComputedQuoteEighthCents,
      computedHourglassQuoteEighthCents: rawComputedQuoteEighthCents,
      hourglassQuoteEighthCents: rawComputedQuoteEighthCents,
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
  it("lists quotes by number and SKU, not raw UUIDs", () => {
    const html = renderToStaticMarkup(
      createElement(RepairQuotesSection, {
        projectId: PROJECT_ID,
        quotes: [quote()],
        connected: true,
      }),
    );
    assert.match(html, /Quote 3 · SKU 1000/);
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

  it("distinguishes Geller retail, Cost columns, burden, and Hourglass quote", () => {
    const html = renderToStaticMarkup(
      createElement(RepairQuoteDetail, {
        quote: quote(),
        projectTitle: "Wagner repair",
        personName: "Ada Lovelace",
      }),
    );
    assert.match(html, /Ada Lovelace/);
    assert.match(html, /Wagner repair/);
    assert.match(html, /Geller Blue Book Version 5\.0 Release 6\.50/);
    assert.match(html, /Price Labor/);
    assert.match(html, /Cost Labor/);
    assert.match(html, /Loaded labor/);
    assert.match(html, /1\.25×/);
    assert.match(html, /2\.5× cost/);
    assert.match(html, /Raw computed quote/);
    assert.match(html, /\$50/);
    assert.doesNotMatch(html, /Shop cost|Metal delta|Gold weight/);
    assert.doesNotMatch(html, new RegExp(QUOTE_ID));
    assert.equal(repairQuoteDisplayTitle(quote()), "Quote 3 · SKU 1000");
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
