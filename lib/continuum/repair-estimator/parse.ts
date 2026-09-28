/**
 * Deterministic founder shorthand. This step never produces a price.
 */

import type {
  RepairColor,
  RepairEstimateRequest,
  RepairMetal,
  RepairOperation,
  RepairPurity,
  RepairSettingType,
  RepairStoneShape,
} from "./types";

function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/→|->/g, " to ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 1000) / 1000);
}

function signed(value: number): string {
  const text = formatNumber(Math.abs(value));
  return value > 0 ? `+${text}` : value < 0 ? `-${text}` : "0";
}

function emptyRequest(raw: string): RepairEstimateRequest {
  return {
    raw,
    operations: [],
    metal: null,
    metalPurity: null,
    metalColor: null,
    laserRequired: true,
    methodRequested: null,
    ring: {
      currentSize: null,
      targetSize: null,
      sizeDelta: null,
      shankWidthMm: null,
      shankThicknessMm: null,
    },
    stone: {
      shape: null,
      caratWeight: null,
      quantity: null,
      stoneType: null,
    },
    setting: {
      existingMounting: null,
      settingType: null,
      prongCount: null,
    },
    finish: {
      polish: false,
      refurbish: false,
      rhodium: false,
      stoneCheck: false,
      tightenStones: false,
    },
    additionalOperations: [],
    notes: [],
    explicitValues: [],
    assumedValues: [],
    missingRequiredValues: [],
  };
}

function readMetal(text: string, request: RepairEstimateRequest): void {
  if (/\b(?:platinum|plat)\b|\bpt\b/.test(text)) {
    request.metal = "platinum";
    request.explicitValues.push("metal: platinum");
    return;
  }

  let purity: RepairPurity | null = null;
  if (/\b10\s?k(?:t|y|w|r)?\b/.test(text)) purity = "10K";
  else if (/\b14\s?k(?:t|y|w|r)?\b|\b14\s+(?:yellow|white|rose)\b/.test(text)) purity = "14K";
  else if (/\b18\s?k(?:t|y|w|r)?\b|\b18\s+(?:yellow|white|rose)\b/.test(text)) purity = "18K";
  else if (/\b20\s?k(?:t|y|w|r)?\b/.test(text)) purity = "20K";

  let color: RepairColor | null = null;
  if (/\b(?:14|18|10|20)\s?ky\b|\byellow\b/.test(text)) color = "yellow";
  else if (/\b(?:14|18|10|20)\s?kw\b|\bwhite\b/.test(text)) color = "white";
  else if (/\b(?:14|18|10|20)\s?kr\b|\brose\b/.test(text)) color = "rose";

  if (/\bgold\b/.test(text) || purity || color) {
    request.metal = "gold";
  }
  request.metalPurity = purity;
  request.metalColor = color;
  if (purity || color) {
    const label = [purity, color, request.metal === "gold" ? "gold" : null]
      .filter(Boolean)
      .join(" ");
    request.explicitValues.push(`metal: ${label}`);
  }
}

function readShape(text: string): RepairStoneShape | null {
  if (/\brbc\b|\bround brilliant\b|\bround\b/.test(text)) return "round_brilliant";
  if (/\boval\b/.test(text)) return "oval";
  if (/\bprincess\b/.test(text)) return "princess";
  if (/\bemerald\b/.test(text)) return "emerald";
  if (/\bpear\b/.test(text)) return "pear";
  if (/\bmarquise\b|\bmarquis\b/.test(text)) return "marquise";
  if (/\bcushion\b/.test(text)) return "cushion";
  if (/\bheart\b/.test(text)) return "heart";
  return null;
}

function readSetting(text: string): RepairSettingType | null {
  if (/\btiffany\b/.test(text)) return "tiffany";
  if (/\bbezel\b/.test(text)) return "bezel";
  if (/\bflush\b/.test(text)) return "flush";
  if (/\bpav[eé]\b|\bbead\b/.test(text)) return "bead";
  if (/\bprongs?\b/.test(text)) return "prong";
  return null;
}

function readSizes(text: string): { current: number; target: number } | null {
  const withoutMeasures = text
    .replace(/\d+(?:\.\d+)?\s*mm\b/g, " ")
    .replace(/\d+(?:\.\d+)?\s*(?:ct|cts|carats?)\b/g, " ");
  const match =
    /(?:\bfrom\s+|\bsize\s+)?(\d+(?:\.\d+)?)\s*(?:down\s+to|up\s+to|to|-)\s*(\d+(?:\.\d+)?)\b/.exec(
      withoutMeasures,
    );
  if (!match) return null;
  const current = Number(match[1]);
  const target = Number(match[2]);
  if (!Number.isFinite(current) || !Number.isFinite(target)) return null;
  return { current, target };
}

function pushOperation(request: RepairEstimateRequest, operation: RepairOperation): void {
  if (!request.operations.includes(operation)) request.operations.push(operation);
}

export function parseRepairEstimate(raw: string): RepairEstimateRequest {
  const text = fold(raw);
  const request = emptyRequest(raw.trim());
  if (!text) return request;

  readMetal(text, request);

  if (/\bsolder\b/.test(text)) request.methodRequested = "solder";
  else if (/\btorch\b/.test(text)) request.methodRequested = "torch";
  else if (/\blaser\b/.test(text)) request.methodRequested = "laser";
  if (request.methodRequested) {
    request.explicitValues.push(`method requested: ${request.methodRequested}`);
    request.notes.push("Hourglass prices laser work. Solder and torch lines are not selected.");
  }

  const mm = /(\d+(?:\.\d+)?)\s*mm\b/.exec(text);
  if (mm) {
    request.ring.shankWidthMm = Number(mm[1]);
    request.explicitValues.push(`shankWidthMm: ${formatNumber(request.ring.shankWidthMm)}`);
  }

  const carat = /(\d+(?:\.\d+)?)\s*(?:ct|cts|carats?)\b/.exec(text);
  if (carat) {
    request.stone.caratWeight = Number(carat[1]);
    request.explicitValues.push(`caratWeight: ${request.stone.caratWeight.toFixed(2)}`);
  }

  const shape = readShape(text);
  if (shape) {
    request.stone.shape = shape;
    request.explicitValues.push(`shape: ${shape}`);
  }

  const prongs = /\b(\d+)\s*-?\s*prongs?\b/.exec(text);
  if (prongs) {
    request.setting.prongCount = Number(prongs[1]);
    request.explicitValues.push(`prongCount: ${request.setting.prongCount}`);
  }

  const setting = readSetting(text);
  if (setting) {
    request.setting.settingType = setting;
    request.explicitValues.push(`settingType: ${setting}`);
  }

  if (/\bexisting mounting\b|\bexisting head\b|\binto\b/.test(text)) {
    request.setting.existingMounting = true;
    request.explicitValues.push("existingMounting: true");
  }

  const sizes = readSizes(text);
  if (sizes) {
    request.ring.currentSize = sizes.current;
    request.ring.targetSize = sizes.target;
    const deltaMilli = Math.round(sizes.target * 1000) - Math.round(sizes.current * 1000);
    request.ring.sizeDelta = deltaMilli / 1000;
    request.explicitValues.push(`currentSize: ${formatNumber(sizes.current)}`);
    request.explicitValues.push(`targetSize: ${formatNumber(sizes.target)}`);
    request.explicitValues.push(`sizeDelta: ${signed(request.ring.sizeDelta)}`);
  }

  const stoneCount = /\b(\d+)\s+stones?\b/.exec(text);
  if (stoneCount) request.stone.quantity = Number(stoneCount[1]);
  else if (/\bone\s+(?:loose\s+)?stone\b/.test(text)) request.stone.quantity = 1;
  if (request.stone.quantity != null) {
    request.explicitValues.push(`stoneQuantity: ${request.stone.quantity}`);
  }
  if (/\bdiamond\b/.test(text)) request.stone.stoneType = "diamond";

  const headChange =
    /\bhead\s+(?:change|replacement)\b|\breplace\b[^.]{0,40}\bhead\b|\bnew head\b/.test(text) &&
    !/\binto\b/.test(text);
  const retip = /\bretips?\b|\bre-tips?\b/.test(text);
  const settingJob =
    /\bstone setting\b|\bsetting\b|\bset\b/.test(text) && !/\bsetting area\b/.test(text);
  const sizingWord = /\bsiz(?:e|ing)\b/.test(text);
  const sizing =
    !headChange &&
    !retip &&
    (sizingWord ||
      (sizes != null &&
        (request.metal != null || request.ring.shankWidthMm != null) &&
        !settingJob));

  if (sizing) pushOperation(request, "ring_sizing");
  if (settingJob && !retip) pushOperation(request, "stone_setting");
  if (headChange) pushOperation(request, "head_replacement");
  if (retip) pushOperation(request, "prong_retip");

  if (/\brhodium\b/.test(text)) {
    request.finish.rhodium = true;
    pushOperation(request, "rhodium");
  }
  if (/\brefurb|\bre-?finish|\bpolish\b/.test(text)) {
    request.finish.refurbish = true;
    request.finish.polish = /\bpolish\b/.test(text);
    pushOperation(request, "refurbish");
  }
  const check = /\bcheck\b/.test(text);
  const tighten = /\btighten\b/.test(text);
  if (check && tighten) {
    request.finish.stoneCheck = true;
    request.finish.tightenStones = true;
    pushOperation(request, "stone_check");
    pushOperation(request, "tighten_stones");
  } else if (tighten) {
    request.finish.tightenStones = true;
    pushOperation(request, "tighten_stones");
  } else if (check && /\bstones?\b/.test(text)) {
    request.finish.stoneCheck = true;
    pushOperation(request, "stone_check");
  }

  if (/\btitanium\b|\btungsten\b|\bstainless\b|\bcobalt\b|\bsmartwatch\b|\bapple watch\b/.test(text)) {
    request.notes.push("unsupported-material");
  }

  return request;
}

export function metalLabel(request: RepairEstimateRequest): string | null {
  if (request.metal === "platinum") return "Platinum";
  if (request.metal !== "gold" && !request.metalPurity) return null;
  const purity = request.metalPurity;
  const color =
    request.metalColor === "yellow"
      ? "Yellow"
      : request.metalColor === "white"
        ? "White"
        : request.metalColor === "rose"
          ? "Rose"
          : null;
  if (!purity && !color) return request.metal === "gold" ? "Gold" : null;
  return [purity, color, "Gold"].filter(Boolean).join(" ");
}

export function formatSize(value: number): string {
  return formatNumber(value);
}
