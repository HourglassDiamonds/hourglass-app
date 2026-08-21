/**
 * Branded share-card geometry. Visualization uses the clean snapshot
 * pixels unchanged — this module only places them on the ivory card.
 */

export const CARD_WIDTH = 1200;
export const CARD_MARGIN = 44;
export const CARD_WORDMARK_TOP = 22;
export const CARD_VIZ_TOP = 48;
export const CARD_VIZ_WIDTH = CARD_WIDTH - CARD_MARGIN * 2;
export const CARD_VIZ_HEIGHT = Math.round((CARD_VIZ_WIDTH * 9) / 7);
export const CARD_FOOTER_GAP = 16;
export const CARD_FOOTER_TOP = CARD_VIZ_TOP + CARD_VIZ_HEIGHT + CARD_FOOTER_GAP;
export const CARD_HEIGHT = CARD_FOOTER_TOP + 96;

export const CARD_COLORS = {
  ivory: "#efe8de",
  ink: "#1c1b1a",
  muted: "#70665d",
  line: "#e4dbcf",
  gold: "#ad9164",
} as const;
