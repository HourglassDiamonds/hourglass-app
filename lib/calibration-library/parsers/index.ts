/**
 * Modular lab-report intelligence — deterministic parser families.
 *
 * TODO(public-tool): upload comparison pool + percentile ranking layer.
 * TODO(public-tool): “top X%” optical interpretation from calibration distributions.
 * TODO(public-tool): comparison database for cross-report statistical bands.
 *
 * Architecture note: compatible with future editorial UI —
 * left rail (metadata, score, percentile), right hero (optical stage),
 * lower grid (proportions, finish, light profile comparisons).
 */

export * from "./types";
export * from "./router";
export * from "./execute-parser";
export * from "./shared";
export * as gcal from "./gcal";
export * as gia from "./gia";
export * as igi from "./igi";
