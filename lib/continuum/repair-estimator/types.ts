/**
 * Founder repair estimate. Prices are never fields on the request.
 * Only the deterministic pricing step may attach a dollar amount.
 */

export const REPAIR_OPERATIONS = [
  "ring_sizing",
  "stone_setting",
  "head_replacement",
  "prong_retip",
  "rhodium",
  "refurbish",
  "stone_check",
  "tighten_stones",
] as const;

export type RepairOperation = (typeof REPAIR_OPERATIONS)[number];

export type RepairMetal = "gold" | "platinum" | "silver";
export type RepairPurity = "10K" | "14K" | "18K" | "20K";
export type RepairColor = "yellow" | "white" | "rose";
export type RepairSettingType = "prong" | "tiffany" | "bezel" | "flush" | "bead";
export type RepairStoneShape =
  | "round_brilliant"
  | "oval"
  | "princess"
  | "emerald"
  | "pear"
  | "marquise"
  | "cushion"
  | "heart";

export type RepairEstimateRequest = {
  raw: string;
  operations: RepairOperation[];
  metal: RepairMetal | null;
  metalPurity: RepairPurity | null;
  metalColor: RepairColor | null;
  laserRequired: true;
  methodRequested: "laser" | "solder" | "torch" | null;
  ring: {
    currentSize: number | null;
    targetSize: number | null;
    sizeDelta: number | null;
    shankWidthMm: number | null;
    shankThicknessMm: number | null;
  };
  stone: {
    shape: RepairStoneShape | null;
    caratWeight: number | null;
    quantity: number | null;
    stoneType: string | null;
  };
  setting: {
    existingMounting: boolean | null;
    settingType: RepairSettingType | null;
    prongCount: number | null;
  };
  finish: {
    polish: boolean;
    refurbish: boolean;
    rhodium: boolean;
    stoneCheck: boolean;
    tightenStones: boolean;
  };
  additionalOperations: string[];
  notes: string[];
  explicitValues: string[];
  assumedValues: string[];
  missingRequiredValues: string[];
};

export type RepairEstimateLineItem = {
  label: string;
  detail: string;
  baseLabel: string;
  modifierLabel: string | null;
  modifierReason: string | null;
  lineLabel: string;
  sourceTask: string;
};

export type RepairEstimate = {
  totalLabel: string;
  rawLabel: string;
  retailCaption: string;
  currency: "USD";
  specs: string[];
  includes: string[];
  lineItems: RepairEstimateLineItem[];
  assumptions: string[];
  inspectionFlags: string[];
  source: {
    editionLabel: string;
    exportFile: string;
    pricingBasis: string;
    matchedTasks: string[];
  };
};

export type RepairEstimateOutcome =
  | {
      status: "estimate";
      request: RepairEstimateRequest;
      estimate: RepairEstimate;
    }
  | {
      status: "clarification";
      request: RepairEstimateRequest;
      question: string;
    }
  | {
      status: "no_reliable_estimate";
      request: RepairEstimateRequest;
      reason: string;
    };
