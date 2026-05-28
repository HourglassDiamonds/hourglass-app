/**
 * GIA report-family parsers.
 * TODO(public-tool): percentile ranking vs GIA upload comparison pool.
 * TODO(public-tool): calibration distribution bands for GIA proportion clusters.
 */

export {
  applyGiaOcrFieldHydrationFallback,
  extractGiaProportionFields,
  getGiaOcrDiagramExtractionWarnings,
  looksLikeGiaReportText,
  probeGiaLiveFieldCandidates,
} from "../../gia-proportions";
