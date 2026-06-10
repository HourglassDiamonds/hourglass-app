import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import { buildDiamondInterpretationContext } from "./client-interpretation-context";
import { presentClientInterpretationScore } from "./client-score-present";
import type { ClientSafeMetadata, ClientSafeReportCapability } from "./client-api";
import {
  buildDiamondDecisionProfile,
  type DiamondDecisionProfile,
} from "./diamond-decision-profile";
import {
  parseReportGradeHints,
  type ReportGradeHints,
} from "./report-grade-hints";

export function buildClientDiamondDecisionProfile(input: {
  fields: CalibrationReportFields;
  metadata: ClientSafeMetadata;
  capability: ClientSafeReportCapability;
  rawScore: number | null;
  reportTextHint?: string;
  gradeHints?: ReportGradeHints;
}): DiamondDecisionProfile {
  const clientScore = presentClientInterpretationScore(
    input.fields,
    input.capability.interpretationLevel,
  );
  const hints =
    input.gradeHints ??
    (input.reportTextHint ? parseReportGradeHints(input.reportTextHint) : {});

  const context = buildDiamondInterpretationContext({
    fields: input.fields,
    rawScore: input.rawScore,
    clarity: hints.clarity,
  });

  return buildDiamondDecisionProfile({
    fields: input.fields,
    metadata: input.metadata,
    capability: input.capability,
    context,
    clientScore,
    displayScore: context.displayScore,
    gradeHints: hints,
  });
}
