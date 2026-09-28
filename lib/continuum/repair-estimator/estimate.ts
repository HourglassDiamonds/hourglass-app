/**
 * Natural language in, repair-book price out.
 * Parsing may interpret words. Dollars come only from Geller cost columns
 * through the Hourglass calculator. No model sits on this path.
 */

import { gellerCatalogRows } from "@/lib/continuum/repair-quoting/catalog";
import { GELLER_BLUE_BOOK, GELLER_COST_BASIS } from "@/lib/continuum/repair-quoting/contract";
import type { GellerCatalogRow } from "@/lib/continuum/repair-quoting/parse-export";
import { formatSize, metalLabel, parseRepairEstimate } from "./parse";
import { priceCatalogRow, roundEstimate } from "./price";
import type {
  RepairEstimate,
  RepairEstimateLineItem,
  RepairEstimateOutcome,
  RepairEstimateRequest,
  RepairStoneShape,
} from "./types";

const PRICING_BASIS = `${GELLER_BLUE_BOOK.editionLabel}. ${GELLER_COST_BASIS}: Cost Labor × 1.25, plus Cost Parts and Cost Other, × 2.5, then nearest $5. Geller retail is not the price.`;

function blockedMethod(description: string): "laser" | "torch" | "solder" | "blended" | "plain" {
  const laser = /\blaser\b/i.test(description);
  const torch = /\btorch\b/i.test(description);
  const solder = /\bsolder\b/i.test(description);
  if (laser && (torch || solder)) return "blended";
  if (torch) return "torch";
  if (solder) return "solder";
  if (laser) return "laser";
  return "plain";
}

function usable(row: GellerCatalogRow, requireLaser: boolean): boolean {
  if (/-HP\b/i.test(row.category) || /-HP\b/i.test(row.taskDescription)) return false;
  const method = blockedMethod(row.taskDescription);
  if (method === "torch" || method === "solder" || method === "blended") return false;
  if (requireLaser && method !== "laser") return false;
  return true;
}

function caratInBand(carat: number, description: string): boolean {
  const open = /(\d+(?:\.\d+)?)\s*ct\s*&\s*up/i.exec(description);
  if (open && carat + 1e-9 >= Number(open[1])) return true;
  const range = /(\d*\.\d+|\d+(?:\.\d+)?)\s*-\s*(\d*\.\d+|\d+(?:\.\d+)?)\s*ct/i.exec(description);
  if (!range) return false;
  const min = Number(range[1]);
  const max = Number(range[2]);
  return carat + 1e-9 >= min && carat <= max + 1e-9;
}

function stoneBandPattern(count: number | null): RegExp | null {
  const band = count == null ? 0 : count;
  if (band <= 4) return /0-4 stones/i;
  if (band <= 20) return /5-20 stones/i;
  if (band <= 35) return /21-35 stones/i;
  if (band <= 50) return /36-50 stones/i;
  return null;
}

function shankPattern(mm: number): { pattern: RegExp; assumption: string | null } | null {
  if (mm < 3) return { pattern: /Narrow Ring-<3mm/i, assumption: null };
  if (mm <= 5) {
    return {
      pattern: /Medium Width-3\.01-5mm/i,
      assumption:
        mm < 3.01
          ? `${formatSize(mm)} mm is quoted on the Medium Width 3.01–5 mm band.`
          : null,
    };
  }
  if (mm <= 8) return { pattern: /Wide Width 5\.01-8\.0mm/i, assumption: null };
  return null;
}

function sizingMetalPattern(request: RepairEstimateRequest): RegExp | null {
  if (request.metal === "platinum") return /^Sizing, Platinum,/i;
  if (request.metalPurity === "14K" && request.metalColor === "yellow") {
    return /^Sizing, 14kt yellow gold,/i;
  }
  if (request.metalPurity === "14K" && request.metalColor === "white") {
    return /^Sizing, 14kt White Gold,/i;
  }
  if (request.metalPurity === "18K" && request.metalColor === "white") {
    return /^Sizing, 18kt White Gold,/i;
  }
  if (request.metalPurity === "18K" && request.metalColor === "yellow") {
    return /^Sizing, 18kt yellow gold,/i;
  }
  return null;
}

function oneRow(rows: GellerCatalogRow[]): GellerCatalogRow | null {
  return rows.length === 1 ? rows[0]! : null;
}

function finishMetal(request: RepairEstimateRequest): "yellow" | "white" | "platinum" | null {
  if (request.metal === "platinum") return "platinum";
  if (request.metalColor === "yellow") return "yellow";
  if (request.metalColor === "white") return "white";
  if (request.finish.rhodium && request.metalColor == null && request.metal == null) return "white";
  return null;
}

function assume(request: RepairEstimateRequest, value: string): void {
  if (!request.assumedValues.includes(value)) request.assumedValues.push(value);
}

function clarify(
  request: RepairEstimateRequest,
  question: string,
  missing: string[],
): RepairEstimateOutcome {
  request.missingRequiredValues = missing;
  return { status: "clarification", request, question };
}

function none(request: RepairEstimateRequest, reason: string): RepairEstimateOutcome {
  return { status: "no_reliable_estimate", request, reason };
}

function inspectionFlags(raw: string, request: RepairEstimateRequest): string[] {
  const text = raw.toLowerCase();
  const flags: string[] = [];
  if (/\b(thin|worn)\b/.test(text)) {
    flags.push("Worn or thin shank. Inspection may change this estimate.");
  }
  if (/\b(chipped|cracked)\b/.test(text)) {
    flags.push("Chipped or cracked stone. Inspection may change this estimate.");
  }
  if (/\bdamaged head\b|\bbroken prong\b/.test(text)) {
    flags.push("Damaged head or prongs. Inspection may change this estimate.");
  }
  if (/\bstones?\b/.test(text) && /\b(siz|shank)\b/.test(text) && !/\bno stones\b/.test(text)) {
    flags.push("Stones may cross the sizing area. Inspection may change this estimate.");
  }
  const delta = request.ring.sizeDelta;
  if (delta != null && Math.abs(delta) >= 3) {
    flags.push("Size change is three sizes or more. Inspection may change this estimate.");
  }
  return flags;
}

function matchSizing(request: RepairEstimateRequest): {
  row: GellerCatalogRow | null;
  reason: string | null;
  assumptions: string[];
} {
  const assumptions: string[] = [];
  const pattern = sizingMetalPattern(request);
  if (!pattern) {
    return {
      row: null,
      reason: "The repair book has no laser sizing line for that metal.",
      assumptions,
    };
  }
  if (request.ring.shankWidthMm == null) {
    return { row: null, reason: null, assumptions };
  }
  const shank = shankPattern(request.ring.shankWidthMm);
  if (!shank) {
    return {
      row: null,
      reason: "That shank width is outside the repair book's sizing bands.",
      assumptions,
    };
  }
  if (shank.assumption) assumptions.push(shank.assumption);
  const stones = stoneBandPattern(request.stone.quantity);
  if (!stones) {
    return {
      row: null,
      reason: "The repair book has no sizing band for that many stones.",
      assumptions,
    };
  }
  if (request.stone.quantity == null) {
    assumptions.push("No stone count was given, so the 0–4 stone band is used.");
  }
  const direction =
    request.ring.sizeDelta == null
      ? null
      : request.ring.sizeDelta > 0
        ? /,\s*Larger,/i
        : request.ring.sizeDelta < 0
          ? /,\s*Smaller,/i
          : null;
  if (!direction) {
    return { row: null, reason: "Those sizes do not change.", assumptions };
  }
  const rows = gellerCatalogRows().filter(
    (row) =>
      row.category === "Sizing" &&
      usable(row, true) &&
      pattern.test(row.taskDescription) &&
      shank.pattern.test(row.taskDescription) &&
      stones.test(row.taskDescription) &&
      direction.test(row.taskDescription),
  );
  if (rows.length !== 1) {
    return {
      row: null,
      reason:
        rows.length === 0
          ? "No laser sizing line matched that metal, shank, and direction."
          : "More than one laser sizing line matched. No price was chosen.",
      assumptions,
    };
  }
  return { row: rows[0]!, reason: null, assumptions };
}

function matchSetting(request: RepairEstimateRequest): GellerCatalogRow[] {
  const carat = request.stone.caratWeight;
  if (carat == null || request.setting.settingType == null) return [];
  return gellerCatalogRows().filter((row) => {
    if (row.category !== "Setting Only" || !usable(row, false)) return false;
    if (!caratInBand(carat, row.taskDescription)) return false;
    if (request.stone.shape === "round_brilliant" && !/^Setting Only, Round,/i.test(row.taskDescription)) {
      return false;
    }
    if (request.stone.shape === "oval") {
      if (!/Fancy Shaped/i.test(row.taskDescription) || !/Oval/i.test(row.taskDescription)) return false;
    } else if (request.stone.shape && request.stone.shape !== "round_brilliant") {
      return false;
    }
    if (request.setting.settingType === "prong") {
      return /Prong-Low Base|Prong, Low Base/i.test(row.taskDescription);
    }
    if (request.setting.settingType === "tiffany") return /Tiffany/i.test(row.taskDescription);
    if (request.setting.settingType === "bezel") return /Channel or Bezel/i.test(row.taskDescription);
    if (request.setting.settingType === "flush") return /Flush Set/i.test(row.taskDescription);
    if (request.setting.settingType === "bead") return /Bead|Pav/i.test(row.taskDescription);
    return false;
  });
}

function matchRefurb(request: RepairEstimateRequest, metal: "yellow" | "white" | "platinum"): GellerCatalogRow | null {
  const metalPattern =
    metal === "platinum" ? /Platinum/i : metal === "white" ? /White Gold/i : /Yellow Gold/i;
  const stonePattern =
    request.stone.quantity == null
      ? /Up To 20 Stones/i
      : request.stone.quantity <= 0
        ? /No Stones/i
        : request.stone.quantity <= 20
          ? /Up To 20 Stones/i
          : request.stone.quantity <= 35
            ? /21 to 35 Stones/i
            : request.stone.quantity <= 50
              ? /36-50 Stones/i
              : null;
  if (!stonePattern) return null;
  return oneRow(
    gellerCatalogRows().filter(
      (row) =>
        row.category === "Polish & Refinishing" &&
        usable(row, false) &&
        /Back To Factory Specs, Rings/i.test(row.taskDescription) &&
        metalPattern.test(row.taskDescription) &&
        stonePattern.test(row.taskDescription),
    ),
  );
}

function matchRhodium(): GellerCatalogRow | null {
  return oneRow(
    gellerCatalogRows().filter(
      (row) =>
        row.category === "Plating" &&
        usable(row, false) &&
        /Rhodium Plating, Ring/i.test(row.taskDescription) &&
        /Pen-Mask/i.test(row.taskDescription) &&
        !/two colors/i.test(row.taskDescription),
    ),
  );
}

function matchTighten(count: number | null): GellerCatalogRow | "missing" | null {
  if (count != null && count < 5) return "missing";
  const pattern =
    count == null || (count >= 5 && count <= 20)
      ? /5 to 20 Stones/i
      : count <= 35
        ? /21 to 35 Stones/i
        : count <= 50
          ? /36 to 50 Stones/i
          : /51 Stones & Over/i;
  return oneRow(
    gellerCatalogRows().filter(
      (row) =>
        row.category === "Setting Only" &&
        usable(row, false) &&
        /Check & Tighten/i.test(row.taskDescription) &&
        pattern.test(row.taskDescription),
    ),
  );
}

function matchHead(request: RepairEstimateRequest): GellerCatalogRow | null {
  const carat = request.stone.caratWeight;
  if (carat == null) return null;
  const style =
    request.setting.settingType === "bezel"
      ? /Bezel/i
      : request.setting.prongCount === 4
        ? /4 prong/i
        : request.setting.prongCount === 6
          ? /6 prong/i
          : null;
  if (!style) return null;
  const metal =
    request.metal === "platinum"
      ? /Platinum/i
      : request.metalPurity === "18K"
        ? /18kt/i
        : request.metalPurity === "14K"
          ? /14kt/i
          : null;
  if (!metal) return null;
  return oneRow(
    gellerCatalogRows().filter(
      (row) =>
        row.category === "Heads & Bezels" &&
        usable(row, false) &&
        /Low Base, Die Struck/i.test(row.taskDescription) &&
        style.test(row.taskDescription) &&
        metal.test(row.taskDescription) &&
        caratInBand(carat, row.taskDescription),
    ),
  );
}

function matchRetip(request: RepairEstimateRequest): GellerCatalogRow | null {
  const metal =
    request.metal === "platinum"
      ? /Tip, Platinum, Laser/i
      : request.metalPurity === "18K"
        ? /Tip, 18kt, Laser/i
        : request.metalPurity === "14K" || request.metal == null
          ? /Tip, 14kt & Silver, Laser/i
          : null;
  if (!metal) return null;
  return oneRow(
    gellerCatalogRows().filter(
      (row) =>
        row.category === "Tips & Prongs" &&
        usable(row, true) &&
        /Tips & Prongs, Tip,/i.test(row.taskDescription) &&
        metal.test(row.taskDescription),
    ),
  );
}

function shapeSupported(shape: RepairStoneShape | null): boolean {
  return shape == null || shape === "round_brilliant" || shape === "oval";
}

function specsFor(request: RepairEstimateRequest): string[] {
  const specs: string[] = [];
  const metal = metalLabel(request);
  if (metal) specs.push(metal);
  if (request.ring.shankWidthMm != null) {
    const width = Number.isInteger(request.ring.shankWidthMm)
      ? request.ring.shankWidthMm.toFixed(1)
      : formatSize(request.ring.shankWidthMm);
    specs.push(`${width} mm shank`);
  }
  if (request.ring.currentSize != null && request.ring.targetSize != null) {
    specs.push(`${formatSize(request.ring.currentSize)} → ${formatSize(request.ring.targetSize)}`);
  }
  if (request.operations.includes("ring_sizing") || request.operations.includes("prong_retip")) {
    specs.push("Laser");
  }
  if (request.stone.shape === "round_brilliant") specs.push("Round brilliant");
  if (request.stone.shape === "oval") specs.push("Oval");
  if (request.stone.caratWeight != null) specs.push(`${request.stone.caratWeight.toFixed(2)} ct`);
  if (request.setting.prongCount != null) specs.push(`${request.setting.prongCount} prong`);
  return specs;
}

function retailCaption(assumptions: readonly string[]): string {
  if (assumptions.some((item) => /14K laser tip/.test(item))) {
    return "Estimated retail — assuming 14K";
  }
  if (assumptions.some((item) => /white gold ring/.test(item))) {
    return "Estimated retail — assuming white gold";
  }
  return "Estimated retail";
}

function buildEstimate(
  request: RepairEstimateRequest,
  lineItems: RepairEstimateLineItem[],
  rawEighthCents: number,
): RepairEstimate {
  const rounded = roundEstimate(rawEighthCents);
  const includes = [...new Set(lineItems.map((line) => line.label))];
  return {
    totalLabel: rounded.totalLabel,
    rawLabel: rounded.rawLabel,
    retailCaption: retailCaption(request.assumedValues),
    currency: "USD",
    specs: specsFor(request),
    includes,
    lineItems,
    assumptions: request.assumedValues,
    inspectionFlags: inspectionFlags(request.raw, request),
    source: {
      editionLabel: GELLER_BLUE_BOOK.editionLabel,
      exportFile: GELLER_BLUE_BOOK.exportFile,
      pricingBasis: PRICING_BASIS,
      matchedTasks: [...new Set(lineItems.map((line) => line.sourceTask))],
    },
  };
}

export function estimateRepair(raw: string): RepairEstimateOutcome {
  const request = parseRepairEstimate(raw);
  if (request.notes.includes("unsupported-material")) {
    return none(
      request,
      "No reliable estimate. The repair book has no line for that material.",
    );
  }
  if (request.operations.length === 0) {
    return none(
      request,
      "No reliable estimate. That request does not match a repair-book operation.",
    );
  }
  if (request.ring.sizeDelta === 0 && request.operations.includes("ring_sizing")) {
    return none(request, "No reliable estimate. Those finger sizes are the same.");
  }

  if (request.operations.includes("ring_sizing")) {
    if (!request.metal || (request.metal === "gold" && (!request.metalPurity || !request.metalColor))) {
      return clarify(request, "Which metal — 14K yellow, 14K white, 18K, or platinum?", [
        "metal",
      ]);
    }
    if (request.ring.currentSize == null || request.ring.targetSize == null) {
      return clarify(request, "What are the current and target finger sizes?", ["ring.size"]);
    }
    if (request.ring.shankWidthMm == null) {
      return clarify(request, "What is the shank width in millimeters?", ["ring.shankWidthMm"]);
    }
  }

  if (request.operations.includes("stone_setting")) {
    if (!shapeSupported(request.stone.shape)) {
      return none(
        request,
        "No reliable estimate. That stone shape is not a single repair-book setting line.",
      );
    }
    if (request.stone.shape == null) {
      return clarify(request, "What stone shape — round or oval?", ["stone.shape"]);
    }
    if (request.stone.caratWeight == null) {
      return clarify(request, "What is the carat weight?", ["stone.caratWeight"]);
    }
    if (request.setting.settingType == null) {
      return clarify(
        request,
        "What type of setting — low-base prong, Tiffany prong, bezel, or other?",
        ["setting.settingType"],
      );
    }
    if (request.setting.settingType === "prong" && request.setting.prongCount == null) {
      return clarify(request, "Is the center held by 4 prongs, 6 prongs, or a bezel?", [
        "setting.prongCount",
      ]);
    }
  }

  const jobs: Array<{ label: string; row: GellerCatalogRow; quantityMilli: number | null }> = [];

  if (request.operations.includes("head_replacement")) {
    if (request.stone.caratWeight == null || (request.setting.prongCount == null && request.setting.settingType !== "bezel")) {
      return clarify(
        request,
        "What head — 4-prong, 6-prong, or bezel — and about what carat size?",
        ["setting.prongCount", "stone.caratWeight"],
      );
    }
    const row = matchHead(request);
    if (!row) {
      return none(
        request,
        "No reliable estimate. Head lines split by base, construction, and carat. This request does not identify one line.",
      );
    }
    if (request.ring.shankWidthMm != null) {
      assume(request, "Shank width is recorded, and it does not change the head line.");
    }
    assume(request, "Head quoted as low-base die-struck.");
    jobs.push({ label: "Head replacement", row, quantityMilli: null });
  }

  if (request.operations.includes("ring_sizing")) {
    const matched = matchSizing(request);
    for (const assumption of matched.assumptions) assume(request, assumption);
    if (!matched.row) {
      return none(request, matched.reason ?? "No reliable estimate. No laser sizing line matched.");
    }
    const delta = Math.abs(request.ring.sizeDelta ?? 0);
    const quantityMilli = Math.round(delta * 1000);
    const perSize = matched.row.maxQty1 != null;
    if (!perSize) {
      assume(
        request,
        "Sizing smaller is one published job price. This line has no additional-size break.",
      );
    } else {
      assume(
        request,
        "Sizing up uses the first-size break, then the next published break for each additional size.",
      );
    }
    assume(request, "Hourglass laser pricing. Torch and solder lines were not used.");
    jobs.push({
      label: "Sizing",
      row: matched.row,
      quantityMilli: perSize ? quantityMilli : null,
    });
  }

  if (request.operations.includes("stone_setting")) {
    if (request.setting.settingType === "prong") {
      assume(request, "Prong setting is quoted as low-base prong, not Tiffany.");
    }
    const rows = matchSetting(request);
    const row = oneRow(rows);
    if (!row) {
      return none(
        request,
        rows.length > 1
          ? "No reliable estimate. More than one setting line matched."
          : "No reliable estimate. No setting line matched that shape, carat, and setting.",
      );
    }
    jobs.push({ label: "Stone setting", row, quantityMilli: null });
  }

  if (request.operations.includes("prong_retip")) {
    if (request.metal == null && request.metalPurity == null) {
      assume(request, "Metal was not stated. Quoted as the 14K laser tip line.");
    }
    const count = request.setting.prongCount;
    if (count == null || count < 1) {
      return clarify(request, "How many prongs are being retipped?", ["setting.prongCount"]);
    }
    const row = matchRetip(request);
    if (!row) return none(request, "No reliable estimate. No laser tip line matched that metal.");
    assume(request, "Hourglass laser tip pricing. Torch tip lines were not used.");
    jobs.push({ label: "Prong retip", row, quantityMilli: count * 1000 });
  }

  const wantsFinish =
    request.operations.includes("refurbish") ||
    request.operations.includes("rhodium") ||
    request.operations.includes("stone_check") ||
    request.operations.includes("tighten_stones");
  if (wantsFinish) {
    const metal = finishMetal(request);
    if (
      (request.operations.includes("refurbish") || request.operations.includes("rhodium")) &&
      metal == null
    ) {
      return clarify(request, "Is this a yellow gold, white gold, or platinum ring?", ["metal"]);
    }
    if (request.operations.includes("refurbish") && metal) {
      if (request.metal == null && metal === "white") {
        assume(request, "Metal was not stated. Rhodium implies a white gold ring.");
      }
      if (request.stone.quantity == null) {
        assume(request, "Refinish uses Back to Factory Specs for a ring, up to 20 stones.");
      }
      const row = matchRefurb(request, metal);
      if (!row) return none(request, "No reliable estimate. No refinish line matched.");
      jobs.push({ label: "Refinish", row, quantityMilli: null });
    }
    if (request.operations.includes("rhodium")) {
      assume(
        request,
        "Rhodium is the single-metal ring pen-mask line, not two-tone masking.",
      );
      const row = matchRhodium();
      if (!row) return none(request, "No reliable estimate. No rhodium ring line matched.");
      jobs.push({ label: "Rhodium", row, quantityMilli: null });
    }
    if (request.finish.stoneCheck || request.finish.tightenStones) {
      const row = matchTighten(request.stone.quantity);
      if (row === "missing") {
        return none(
          request,
          "No reliable estimate. Check-and-tighten starts at the 5 to 20 stone band. One loose stone has no separate line.",
        );
      }
      if (!row) return none(request, "No reliable estimate. No check-and-tighten line matched.");
      if (request.stone.quantity == null) {
        assume(
          request,
          "Check and tighten is a separate line on the 5–20 stone band. It is not included in refinish or rhodium.",
        );
      }
      jobs.push({ label: "Check and tighten stones", row, quantityMilli: null });
    }
  }

  if (request.methodRequested === "solder" || request.methodRequested === "torch") {
    assume(request, "Solder and torch wording did not change the laser line.");
  }

  const lineItems: RepairEstimateLineItem[] = [];
  let rawTotal = 0;
  for (const job of jobs) {
    const priced = priceCatalogRow(job.row, {
      label: job.label,
      quantityMilli: job.quantityMilli,
    });
    if (!priced) {
      return none(
        request,
        "No reliable estimate. The matched line does not publish enough quantity breaks to price that count.",
      );
    }
    if (priced.quantityMode === "each" && job.label === "Sizing") {
      for (const line of priced.lineItems) {
        line.detail = line.detail.replaceAll("unit", "size");
        line.modifierReason = line.modifierReason?.replaceAll("unit", "size") ?? null;
      }
    }
    if (priced.quantityMode === "each" && job.label === "Prong retip") {
      for (const line of priced.lineItems) {
        line.detail = line.detail.replaceAll("unit", "tip");
        line.modifierReason = line.modifierReason?.replaceAll("unit", "tip") ?? null;
      }
    }
    lineItems.push(...priced.lineItems);
    rawTotal += priced.rawEighthCents;
  }

  if (lineItems.length === 0) {
    return none(request, "No reliable estimate. No repair-book line was priced.");
  }

  return {
    status: "estimate",
    request,
    estimate: buildEstimate(request, lineItems, rawTotal),
  };
}
