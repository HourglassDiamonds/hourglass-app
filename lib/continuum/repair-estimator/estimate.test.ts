import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { describe, it } from "node:test";
import { gellerCatalogRows } from "@/lib/continuum/repair-quoting/catalog";
import {
  formatUsdEighthCents,
  hourglassQuoteEighthCents,
  roundToNearestFiveDollarsEighthCents,
} from "@/lib/continuum/repair-quoting/money";
import type { GellerSourceAmounts } from "@/lib/continuum/repair-quoting/source";
import { estimateRepair } from "./estimate";
import { parseRepairEstimate } from "./parse";
import { additionalBreaks } from "./price";
import type { RepairEstimateOutcome } from "./types";

const PROMPTS = {
  sizingUp: "14ky gold 2mm shank width, sizing price to go from 6-7.75",
  sizingDown: "14kw 3mm size 8 down to 6.5",
  platinum: "platinum 2mm size 6 to 6.75",
  settingAmbiguous: "stone setting 2ct rbc into existing mounting",
  oval: "set a 1.25 ct oval into a 4 prong head",
  bundle: "rhodium and refurb, check and tighten stones included",
  head: "14ky head change on 2mm shank",
  retip: "retip 4 prongs",
  oneStone: "tighten one loose stone",
  clarifySetting: "set a 2ct stone into the mounting",
  unsupported: "weld a titanium wedding band",
  vague: "the ring needs something",
} as const;

function assertNoPrice(result: RepairEstimateOutcome): void {
  assert.notEqual(result.status, "estimate");
  assert.equal("estimate" in result, false);
  assert.doesNotMatch(JSON.stringify(result), /\$\s?\d/);
}

function rawOf(amounts: GellerSourceAmounts): number {
  return hourglassQuoteEighthCents({
    costLaborCents: amounts.costLaborCents,
    costPartsCents: amounts.costPartsCents,
    costOtherCents: amounts.costOtherCents,
  });
}

describe("repair estimate parser", () => {
  it("normalizes 14ky sizing shorthand", () => {
    const request = parseRepairEstimate(PROMPTS.sizingUp);
    assert.deepEqual(request.operations, ["ring_sizing"]);
    assert.equal(request.metal, "gold");
    assert.equal(request.metalPurity, "14K");
    assert.equal(request.metalColor, "yellow");
    assert.equal(request.laserRequired, true);
    assert.equal(request.ring.currentSize, 6);
    assert.equal(request.ring.targetSize, 7.75);
    assert.equal(request.ring.sizeDelta, 1.75);
    assert.equal(request.ring.shankWidthMm, 2);
    assert.equal("total" in request, false);
  });

  it("normalizes white gold, platinum, carat, and bundled finish words", () => {
    const down = parseRepairEstimate(PROMPTS.sizingDown);
    assert.equal(down.metalColor, "white");
    assert.equal(down.ring.currentSize, 8);
    assert.equal(down.ring.targetSize, 6.5);
    assert.equal(down.ring.sizeDelta, -1.5);
    assert.equal(down.ring.shankWidthMm, 3);

    const platinum = parseRepairEstimate("pt 2 mm wide, size 6 to 6.75");
    assert.equal(platinum.metal, "platinum");
    assert.equal(platinum.ring.shankWidthMm, 2);
    assert.equal(platinum.ring.sizeDelta, 0.75);

    const stone = parseRepairEstimate(PROMPTS.settingAmbiguous);
    assert.equal(stone.stone.shape, "round_brilliant");
    assert.equal(stone.stone.caratWeight, 2);
    assert.equal(stone.setting.existingMounting, true);

    const finish = parseRepairEstimate(PROMPTS.bundle);
    assert.equal(finish.finish.rhodium, true);
    assert.equal(finish.finish.refurbish, true);
    assert.equal(finish.finish.stoneCheck, true);
    assert.equal(finish.finish.tightenStones, true);
  });
});

describe("deterministic repair pricing", () => {
  it("prices 14ky laser sizing from 6 to 7.75 with the additional-size break", () => {
    const result = estimateRepair(PROMPTS.sizingUp);
    assert.equal(result.status, "estimate");
    if (result.status !== "estimate") return;
    const task = result.estimate.source.matchedTasks[0] ?? "";
    assert.equal(
      task,
      "Sizing, 14kt yellow gold, Narrow Ring-<3mm, 0-4 stones, Larger, Laser",
    );
    assert.match(task, /Laser/);
    assert.doesNotMatch(task, /Torch|Solder/);
    const row = gellerCatalogRows().find((item) => item.taskDescription === task);
    assert.ok(row);
    const extra = additionalBreaks(row.sku)[0];
    assert.ok(extra);
    const raw = rawOf(row.amounts) + Math.round((rawOf(extra.amounts) * 3) / 4);
    assert.equal(result.estimate.rawLabel, formatUsdEighthCents(raw));
    assert.equal(
      result.estimate.totalLabel,
      formatUsdEighthCents(roundToNearestFiveDollarsEighthCents(raw)),
    );
    assert.equal(result.estimate.specs.includes("6 → 7.75"), true);
    assert.equal(result.estimate.inspectionFlags.length, 0);
    assert.equal(result.estimate.retailCaption, "Estimated retail");
  });

  it("does not price 14kw 3.00 mm as the Medium band", () => {
    const result = estimateRepair(PROMPTS.sizingDown);
    assert.equal(result.status, "clarification");
    if (result.status !== "clarification") return;
    assert.match(result.question, /3 mm is not a sizing band/);
    assert.match(result.question, /Narrow under 3 mm/);
    assert.match(result.question, /Medium from 3\.01 mm/);
    assertNoPrice(result);
  });

  it("prices a three-quarter platinum laser size from the first break only", () => {
    const result = estimateRepair(PROMPTS.platinum);
    assert.equal(result.status, "estimate");
    if (result.status !== "estimate") return;
    const task = result.estimate.source.matchedTasks[0] ?? "";
    assert.match(task, /^Sizing, Platinum, Narrow Ring-<3mm, 0-4 stones, Larger, Laser$/);
    const row = gellerCatalogRows().find((item) => item.taskDescription === task);
    assert.ok(row);
    const raw = Math.round((rawOf(row.amounts) * 3) / 4);
    assert.equal(result.estimate.rawLabel, formatUsdEighthCents(raw));
  });

  it("asks which setting a 2ct round uses instead of picking a price", () => {
    const result = estimateRepair(PROMPTS.settingAmbiguous);
    assert.equal(result.status, "clarification");
    if (result.status !== "clarification") return;
    assert.match(result.question, /low-base prong, Tiffany prong, bezel/);
    assertNoPrice(result);
  });

  it("prices a 1.25ct oval in a 4-prong head as low-base setting", () => {
    const result = estimateRepair(PROMPTS.oval);
    assert.equal(result.status, "estimate");
    if (result.status !== "estimate") return;
    assert.equal(result.estimate.source.matchedTasks.length, 1);
    assert.match(
      result.estimate.source.matchedTasks[0] ?? "",
      /Setting Only, Fancy Shaped, Prong-Low Base, Oval-Pear-Heart, 1\.01-1\.50ct/,
    );
    assert.match(result.estimate.assumptions.join(" "), /not Tiffany/);
  });

  it("prices rhodium, refinish, and check-and-tighten once each", () => {
    const result = estimateRepair(
      "rhodium and refurb, check and tighten stones included, plus rhodium and tighten",
    );
    assert.equal(result.status, "estimate");
    if (result.status !== "estimate") return;
    assert.deepEqual(
      result.estimate.includes,
      ["Refinish", "Rhodium", "Check and tighten stones"],
    );
    assert.equal(result.estimate.lineItems.length, 3);
    assert.match(result.estimate.source.matchedTasks.join(" "), /White Gold/);
    assert.match(result.estimate.source.matchedTasks.join(" "), /Pen-Mask/);
    assert.match(result.estimate.source.matchedTasks.join(" "), /5 to 20 Stones/);
    assert.doesNotMatch(result.estimate.source.matchedTasks.join(" "), /-HP|Torch|two colors/);
    assert.match(result.estimate.assumptions.join(" "), /not included in refinish or rhodium/);
    assert.equal(result.estimate.retailCaption, "Estimated retail — assuming white gold");
  });

  it("asks for head style and carat instead of pricing a bare head change", () => {
    const result = estimateRepair(PROMPTS.head);
    assert.equal(result.status, "clarification");
    if (result.status !== "clarification") return;
    assert.match(result.question, /4-prong, 6-prong, or bezel/);
    assertNoPrice(result);
  });

  it("prices a specified 14K 4-prong head from the die-struck line", () => {
    const result = estimateRepair("replace 14ky head, 4 prong, 1ct");
    assert.equal(result.status, "estimate");
    if (result.status !== "estimate") return;
    assert.match(
      result.estimate.source.matchedTasks[0] ?? "",
      /Heads & Bezels, Low Base, Die Struck, 4 prong, 14kt, \.76-1\.0cts/,
    );
  });

  it("prices four 14K laser tips and not the torch tip", () => {
    const result = estimateRepair(PROMPTS.retip);
    assert.equal(result.status, "estimate");
    if (result.status !== "estimate") return;
    const task = result.estimate.source.matchedTasks[0] ?? "";
    assert.equal(task, "Tips & Prongs, Tip, 14kt & Silver, Laser");
    assert.doesNotMatch(task, /Torch/);
    assert.equal(result.estimate.lineItems.length, 2);
    assert.match(result.estimate.assumptions.join(" "), /14K laser tip/);
    assert.equal(result.estimate.retailCaption, "Estimated retail — assuming 14K");
  });

  it("does not invent a price for one loose stone", () => {
    const result = estimateRepair(PROMPTS.oneStone);
    assert.equal(result.status, "no_reliable_estimate");
    if (result.status !== "no_reliable_estimate") return;
    assert.match(result.reason, /5 to 20/);
    assertNoPrice(result);
  });

  it("asks one question when a setting has no shape", () => {
    const result = estimateRepair(PROMPTS.clarifySetting);
    assert.equal(result.status, "clarification");
    if (result.status !== "clarification") return;
    assert.match(result.question, /round or oval/);
    assertNoPrice(result);
  });

  it("refuses an unsupported material and a vague request", () => {
    const unsupported = estimateRepair(PROMPTS.unsupported);
    const vague = estimateRepair(PROMPTS.vague);
    assert.equal(unsupported.status, "no_reliable_estimate");
    assert.equal(vague.status, "no_reliable_estimate");
    assertNoPrice(unsupported);
    assertNoPrice(vague);
  });
});

describe("laser-only repair pricing", () => {
  it("keeps laser sizing when the prompt asks for solder or torch", () => {
    const result = estimateRepair(
      "please torch solder this instead of laser, 14ky 2mm from 6 to 7.75",
    );
    assert.equal(result.status, "estimate");
    if (result.status !== "estimate") return;
    for (const task of result.estimate.source.matchedTasks) {
      assert.match(task, /\bLaser\b/);
      assert.doesNotMatch(task, /\bTorch\b/);
      assert.equal(/\blaser\b/i.test(task) && /\b(torch|solder)\b/i.test(task), false);
    }
    assert.match(result.estimate.assumptions.join(" "), /Solder and torch wording/);
  });

  it("does not price a blended laser and torch solder line", () => {
    const result = estimateRepair("solder a hollow rope chain");
    assert.equal(result.status, "no_reliable_estimate");
    assertNoPrice(result);
    const blob = JSON.stringify(result);
    assert.doesNotMatch(blob, /Hollow Rope/);
  });
});

describe("repair book boundary gaps", () => {
  function sizing(mm: string) {
    return estimateRepair(`14ky ${mm} size 6 to 7`);
  }

  function band(result: RepairEstimateOutcome): string | null {
    if (result.status !== "estimate") return null;
    const task = result.estimate.source.matchedTasks[0] ?? "";
    const found = /Narrow Ring-<3mm|Medium Width-3\.01-5mm|Wide Width 5\.01-8\.0mm/.exec(task);
    return found?.[0] ?? null;
  }

  it("assigns written shank bands and does not cross the 3.00 mm gap", () => {
    assert.equal(band(sizing("2.99mm")), "Narrow Ring-<3mm");
    const exact = sizing("3.00mm");
    assert.equal(exact.status, "clarification");
    assertNoPrice(exact);
    assert.equal(band(sizing("3.01mm")), "Medium Width-3.01-5mm");
    assert.equal(band(sizing("4.99mm")), "Medium Width-3.01-5mm");
    assert.equal(band(sizing("5.00mm")), "Medium Width-3.01-5mm");
    const between = sizing("5.005mm");
    assert.equal(between.status, "clarification");
    assertNoPrice(between);
    assert.equal(band(sizing("5.01mm")), "Wide Width 5.01-8.0mm");
    assert.equal(band(sizing("8.0mm")), "Wide Width 5.01-8.0mm");
    const pastWide = sizing("8.1mm");
    assert.equal(pastWide.status, "no_reliable_estimate");
    assertNoPrice(pastWide);
  });

  it("keeps fractional larger-sizing inside the published Max Qty ceilings", () => {
    const up = estimateRepair(PROMPTS.sizingUp);
    assert.equal(up.status, "estimate");
    if (up.status !== "estimate") return;
    const task = up.estimate.source.matchedTasks[0] ?? "";
    const row = gellerCatalogRows().find((item) => item.taskDescription === task);
    assert.equal(row?.maxQty1, 1);
    assert.equal(additionalBreaks(row?.sku ?? "").length, 1);
    assert.match(up.estimate.lineItems[0]?.detail ?? "", /First size/);
    assert.match(up.estimate.lineItems[1]?.detail ?? "", /0\.75 additional size/);

    const platinum = estimateRepair(PROMPTS.platinum);
    assert.equal(platinum.status, "estimate");
    if (platinum.status !== "estimate") return;
    const platinumTask = platinum.estimate.source.matchedTasks[0] ?? "";
    const platinumRow = gellerCatalogRows().find((item) => item.taskDescription === platinumTask);
    assert.equal(platinumRow?.maxQty1, 1);
    assert.match(platinum.estimate.lineItems[0]?.detail ?? "", /0\.75 of the first size/);
    assert.equal(platinum.estimate.lineItems.length, 1);
  });

  it("does not place a carat in the next setting band across a gap", () => {
    const atOne = estimateRepair("set a 1.00 ct round into a 4 prong head");
    assert.equal(atOne.status, "estimate");
    if (atOne.status !== "estimate") return;
    assert.match(atOne.estimate.source.matchedTasks[0] ?? "", /\.76-1\.0ct/);
    assert.doesNotMatch(atOne.estimate.source.matchedTasks[0] ?? "", /1\.01-1\.50/);

    const gap = estimateRepair("set a 1.005 ct round into a 4 prong head");
    assert.equal(gap.status, "no_reliable_estimate");
    assertNoPrice(gap);

    const next = estimateRepair("set a 1.01 ct round into a 4 prong head");
    assert.equal(next.status, "estimate");
    if (next.status !== "estimate") return;
    assert.match(next.estimate.source.matchedTasks[0] ?? "", /1\.01-1\.50ct/);
  });

  it("does not use the 5-to-20 tighten band below 5 stones", () => {
    const four = estimateRepair("check and tighten 4 stones");
    assert.equal(four.status, "no_reliable_estimate");
    assertNoPrice(four);
    const five = estimateRepair("check and tighten 5 stones");
    assert.equal(five.status, "estimate");
    if (five.status !== "estimate") return;
    assert.match(five.estimate.source.matchedTasks[0] ?? "", /5 to 20 Stones/);
    const twenty = estimateRepair("check and tighten 20 stones");
    assert.equal(twenty.status, "estimate");
    if (twenty.status !== "estimate") return;
    assert.match(twenty.estimate.source.matchedTasks[0] ?? "", /5 to 20 Stones/);
    const twentyOne = estimateRepair("check and tighten 21 stones");
    assert.equal(twentyOne.status, "estimate");
    if (twentyOne.status !== "estimate") return;
    assert.match(twentyOne.estimate.source.matchedTasks[0] ?? "", /21 to 35 Stones/);
  });

  it("does not price sizing above the 36-50 stone band", () => {
    const result = estimateRepair("14ky 2mm size 6 to 7 with 51 stones");
    assert.equal(result.status, "no_reliable_estimate");
    assertNoPrice(result);
  });
});

describe("repair estimator speed", () => {
  it("parses and prices the common sizing prompt well under 500ms", () => {
    const parseStarted = performance.now();
    for (let i = 0; i < 200; i += 1) parseRepairEstimate(PROMPTS.sizingUp);
    const parseEach = (performance.now() - parseStarted) / 200;
    const priceStarted = performance.now();
    for (let i = 0; i < 50; i += 1) estimateRepair(PROMPTS.sizingUp);
    const priceEach = (performance.now() - priceStarted) / 50;
    assert.ok(parseEach < 5, `parser ${parseEach}ms`);
    assert.ok(priceEach < 500, `pricing ${priceEach}ms`);
  });
});
