export {
  MEASUREMENT_HEALTH_CODES,
  classifyMeasurementFailure,
  founderLabelForHealthCode,
  shortenMeasurementGapLabel,
  isConfigOrAuthFailure,
  isHealthyOrEmpty,
  type MeasurementHealthCode,
  type MeasurementSourceKind,
} from "./health-codes";

export {
  MEASUREMENT_TIMEZONE,
  getAgentOsMeasurementWindows,
  getWindowsEndingOn,
  sourceAgeDays,
  classifyGscLag,
  isCompletedLocalDay,
  localMidnightUtcIso,
  shiftCalendarDays,
  type AgentOsMeasurementWindows,
  type DateRange,
} from "./date-windows";

export {
  GSC_SOURCE_TIMEZONE,
  GSC_FALLBACK_INCOMPLETE_LAG_DAYS,
  resolveGscFreshnessBoundary,
  classifyGscSourceLag,
  extractFirstIncompleteDate,
  mapDateDimensionRows,
  type GscDateActivityRow,
  type GscFreshnessBoundary,
} from "./gsc-freshness";

export {
  assessChange,
  safePercentChange,
  shouldSuppressGscRowForFounderPriority,
  dedupeStable,
  judgeChange,
  formatFounderMetricChange,
  type ChangeAssessment,
  type ChangeMathOptions,
  type ChangeJudgment,
} from "./change-math";

export {
  detectMeasurementEnvPresence,
  runMeasurementPreflight,
  preflightShouldExitNonzero,
  type EnvPresence,
  type MeasurementPreflightResult,
} from "./preflight";
