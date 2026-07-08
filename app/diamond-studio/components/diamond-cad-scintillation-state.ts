import { CAD_SCINTILLATION_MIN_INTERVAL_MS } from "./diamond-cad-light";

export type ScintillationSlot = { variant: number; visible: boolean };
export type ScintillationFront = "a" | "b";

export type ScintillationAdvanceResult = {
  accepted: boolean;
  nextIndex: number;
  patternIndex: number;
  lastAdvanceAt: number;
};

/**
 * Pure helper: decide whether a carat change advances the pattern and to which index.
 */
export function computeScintillationAdvance(args: {
  active: boolean;
  carat: number;
  lastCarat: number;
  patternIndex: number;
  lastAdvanceAt: number;
  now: number;
  variantCount: number;
  minIntervalMs?: number;
}): ScintillationAdvanceResult {
  const minInterval =
    args.minIntervalMs ?? CAD_SCINTILLATION_MIN_INTERVAL_MS;
  const unchanged = Math.abs(args.carat - args.lastCarat) < 0.001;
  if (unchanged || !args.active) {
    return {
      accepted: false,
      nextIndex: args.patternIndex,
      patternIndex: args.patternIndex,
      lastAdvanceAt: args.lastAdvanceAt,
    };
  }

  const isFirst = args.patternIndex < 0;
  const elapsed = args.now - args.lastAdvanceAt;
  if (!isFirst && elapsed < minInterval) {
    return {
      accepted: false,
      nextIndex: args.patternIndex,
      patternIndex: args.patternIndex,
      lastAdvanceAt: args.lastAdvanceAt,
    };
  }

  const count = Math.max(1, args.variantCount);
  const next = isFirst ? 0 : (args.patternIndex + 1) % count;
  return {
    accepted: true,
    nextIndex: next,
    patternIndex: next,
    lastAdvanceAt: args.now,
  };
}

export function nextScintillationSlots(args: {
  reducedMotion: boolean;
  nextIndex: number;
  front: ScintillationFront;
  slotA: ScintillationSlot;
  slotB: ScintillationSlot;
}): {
  front: ScintillationFront;
  slotA: ScintillationSlot;
  slotB: ScintillationSlot;
  patternIndex: number;
} {
  if (args.reducedMotion) {
    return {
      front: "a",
      slotA: { variant: args.nextIndex, visible: true },
      slotB: { variant: args.nextIndex, visible: false },
      patternIndex: args.nextIndex,
    };
  }

  if (args.front === "a") {
    return {
      front: "b",
      slotA: { ...args.slotA, visible: false },
      slotB: { variant: args.nextIndex, visible: true },
      patternIndex: args.nextIndex,
    };
  }

  return {
    front: "a",
    slotA: { variant: args.nextIndex, visible: true },
    slotB: { ...args.slotB, visible: false },
    patternIndex: args.nextIndex,
  };
}

/** Reset scintillation machine when the selected shape changes. */
export function resetScintillationState(): {
  patternIndex: number;
  lastAdvanceAt: number;
  front: ScintillationFront;
  slotA: ScintillationSlot;
  slotB: ScintillationSlot;
} {
  return {
    patternIndex: -1,
    lastAdvanceAt: 0,
    front: "b",
    slotA: { variant: 0, visible: false },
    slotB: { variant: 0, visible: false },
  };
}

export function hideScintillationSlots(
  slotA: ScintillationSlot,
  slotB: ScintillationSlot,
): { slotA: ScintillationSlot; slotB: ScintillationSlot } {
  return {
    slotA: { ...slotA, visible: false },
    slotB: { ...slotB, visible: false },
  };
}
