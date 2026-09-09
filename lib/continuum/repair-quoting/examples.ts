/**
 * Founder-only V1 quote examples. Not a public calculator.
 */

import { calculateRepairQuote } from "./calculate";
import { lookupVerifiedSku } from "./source";
import type { RepairQuoteCalculateResult, RepairQuoteLineInput } from "./types";

function skuLine(
  sku: string,
  extra: Partial<RepairQuoteLineInput> = {},
): RepairQuoteLineInput {
  const verified = lookupVerifiedSku(sku);
  if (!verified) throw new Error("missing-verified-sku");
  return {
    sku: verified.sku,
    taskDescription: verified.taskDescription,
    amounts: verified.amounts,
    metalBand: verified.metalBand,
    hasExplicitMetalQuantity: verified.hasExplicitMetalQuantity,
    inventedMetalQuantity: false,
    expressSelected: false,
    costBasis: "geller_cost_columns",
    ...extra,
  };
}

export type FounderQuoteExample = {
  id: "geller-range" | "above-range" | "labor-only" | "missing-weight" | "founder-override";
  title: string;
  body: string;
  result: RepairQuoteCalculateResult;
};

export function founderQuoteExamples(): FounderQuoteExample[] {
  const sku1000 = lookupVerifiedSku("1000");
  const sku1008 = lookupVerifiedSku("1008");
  if (!sku1000 || !sku1008) throw new Error("missing-verified-sku");
  return [
    {
      id: "geller-range",
      title: "A. Normal Geller-range repair",
      body: "SKU 1008 uses published Cost Labor and Cost Parts. No dynamic metal.",
      result: calculateRepairQuote({
        repairType: sku1008.repairType,
        metalFamily: sku1008.metalFamily,
        line: skuLine("1008"),
      }),
    },
    {
      id: "above-range",
      title: "B. Gold-sensitive repair above Geller range",
      body: "SKU 1000 labor plus 1.000 dwt of 14K at $6,250/oz. Metal is extrapolated; labor is unchanged.",
      result: calculateRepairQuote({
        repairType: sku1000.repairType,
        metalFamily: sku1000.metalFamily,
        line: skuLine("1000", {
          goldUsdPerOz: 6250,
          millidwt: 1000,
          metalSensitive: { goldUsdPerOz: 6250, millidwt: 1000 },
        }),
      }),
    },
    {
      id: "labor-only",
      title: "C. Labor-only repair",
      body: "SKU 1000 Cost Labor only. No metal quantity, no gold spot.",
      result: calculateRepairQuote({
        repairType: sku1000.repairType,
        metalFamily: sku1000.metalFamily,
        line: skuLine("1000"),
      }),
    },
    {
      id: "missing-weight",
      title: "D. Missing-weight case that fails closed",
      body: "Gold spot without supported dwt cannot invent weight.",
      result: calculateRepairQuote({
        repairType: sku1000.repairType,
        metalFamily: sku1000.metalFamily,
        line: skuLine("1000", { goldUsdPerOz: 6000 }),
      }),
    },
    {
      id: "founder-override",
      title: "E. Founder manual override",
      body: "Raw and rounded quotes stay on the snapshot. Final quote is the founder override.",
      result: calculateRepairQuote({
        repairType: sku1000.repairType,
        metalFamily: sku1000.metalFamily,
        line: skuLine("1000"),
        overrideAmountCents: 7_500,
        overrideReason: "Founder quoted verbally at the bench",
      }),
    },
  ];
}
