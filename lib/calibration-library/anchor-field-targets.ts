import { GCAL353466126_EXPECTED } from "./fixtures/gcal353466126";
import { GCAL360796191_EXPECTED } from "./fixtures/gcal360796191";
import { GIA2527039693_EXPECTED } from "./fixtures/gia2527039693";
import {
  LG773657228_EXPECTED,
  LG773657228_GRADING_EXPECTED,
} from "./fixtures/lg773657228";
import type { ReportFieldKey } from "./types";

export type AnchorFieldTargets = Partial<Record<ReportFieldKey, string>>;

export const ANCHOR_FIELD_TARGETS: Record<string, AnchorFieldTargets> = {
  LG353466126: {
    shape: GCAL353466126_EXPECTED.shape,
    carat: GCAL353466126_EXPECTED.carat,
    measurements: GCAL353466126_EXPECTED.measurements,
    tablePercent: GCAL353466126_EXPECTED.tablePercent,
    depthPercent: GCAL353466126_EXPECTED.depthPercent,
    crownAngle: GCAL353466126_EXPECTED.crownAngle,
    pavilionAngle: GCAL353466126_EXPECTED.pavilionAngle,
    lowerHalfPercent: GCAL353466126_EXPECTED.lowerHalfPercent,
    starLengthPercent: GCAL353466126_EXPECTED.starLengthPercent,
    girdle: GCAL353466126_EXPECTED.girdle,
    culet: GCAL353466126_EXPECTED.culet,
    polish: GCAL353466126_EXPECTED.polish,
    symmetry: GCAL353466126_EXPECTED.symmetry,
    fluorescence: GCAL353466126_EXPECTED.fluorescence,
    cutGrade: GCAL353466126_EXPECTED.cutGrade,
  },
  LG360796191: {
    shape: GCAL360796191_EXPECTED.shape,
    carat: GCAL360796191_EXPECTED.carat,
    measurements: GCAL360796191_EXPECTED.measurements,
    tablePercent: GCAL360796191_EXPECTED.tablePercent,
    depthPercent: GCAL360796191_EXPECTED.depthPercent,
    crownAngle: GCAL360796191_EXPECTED.crownAngle,
    pavilionAngle: GCAL360796191_EXPECTED.pavilionAngle,
    lowerHalfPercent: GCAL360796191_EXPECTED.lowerHalfPercent,
    starLengthPercent: GCAL360796191_EXPECTED.starLengthPercent,
    girdle: GCAL360796191_EXPECTED.girdle,
    culet: GCAL360796191_EXPECTED.culet,
    fluorescence: GCAL360796191_EXPECTED.fluorescence,
    polish: "Excellent",
    symmetry: "Excellent",
    cutGrade: "Excellent",
  },
  LG773657228: {
    shape: LG773657228_GRADING_EXPECTED.shape,
    carat: LG773657228_GRADING_EXPECTED.carat,
    measurements: LG773657228_EXPECTED.measurements,
    tablePercent: LG773657228_EXPECTED.tablePercent,
    depthPercent: LG773657228_EXPECTED.depthPercent,
    crownAngle: LG773657228_EXPECTED.crownAngle,
    pavilionAngle: LG773657228_EXPECTED.pavilionAngle,
    starLengthPercent: LG773657228_EXPECTED.starLengthPercent,
    girdle: LG773657228_EXPECTED.girdle,
    culet: LG773657228_EXPECTED.culet,
    polish: LG773657228_GRADING_EXPECTED.polish,
    symmetry: LG773657228_GRADING_EXPECTED.symmetry,
    fluorescence: LG773657228_GRADING_EXPECTED.fluorescence,
  },
  "2527039693": {
    shape: GIA2527039693_EXPECTED.shape,
    carat: GIA2527039693_EXPECTED.carat,
    measurements: GIA2527039693_EXPECTED.measurements,
    tablePercent: GIA2527039693_EXPECTED.tablePercent,
    depthPercent: GIA2527039693_EXPECTED.depthPercent,
    crownAngle: GIA2527039693_EXPECTED.crownAngle,
    pavilionAngle: GIA2527039693_EXPECTED.pavilionAngle,
    lowerHalfPercent: GIA2527039693_EXPECTED.lowerHalfPercent,
    starLengthPercent: GIA2527039693_EXPECTED.starLengthPercent,
    girdle: GIA2527039693_EXPECTED.girdle,
    culet: GIA2527039693_EXPECTED.culet,
    polish: GIA2527039693_EXPECTED.polish,
    symmetry: GIA2527039693_EXPECTED.symmetry,
    fluorescence: GIA2527039693_EXPECTED.fluorescence,
    cutGrade: GIA2527039693_EXPECTED.cutGrade,
  },
};
