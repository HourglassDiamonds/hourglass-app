import {
  buildProportionDesignFingerprint,
  buildScoringDriverFingerprint,
  LAB_NEUTRAL_SCORE,
  labGradeDisagreementNote,
} from "./scoring/scoring-inputs";
import type { LpTestRow } from "./light-performance-test-rows";
import { SCORE_MATCH_TOLERANCE } from "./light-performance-test-rows";

export type CrossLabGroup = {
  fingerprint: string;
  fingerprintKind: "proportion-design" | "full-scoring-driver";
  labs: string[];
  reportNumbers: string[];
  scores: number[];
  consistent: boolean;
  note?: string;
};

export type CrossLabConsistencyReport = {
  labNeutralScore: boolean;
  proportionDesignGroups: CrossLabGroup[];
  fullDriverGroups: CrossLabGroup[];
  proportionInconsistencies: CrossLabGroup[];
  fullDriverInconsistencies: CrossLabGroup[];
};

function buildGroups(
  rows: LpTestRow[],
  fingerprintKind: "proportion-design" | "full-scoring-driver",
): CrossLabGroup[] {
  const eligible = rows.filter(
    (r) => r.recalculatedEligible && r.recalculatedScore != null,
  );
  const map = new Map<string, LpTestRow[]>();

  for (const row of eligible) {
    const fields = row.entry.fieldsNormalized ?? row.entry.fields;
    const fp =
      fingerprintKind === "proportion-design"
        ? buildProportionDesignFingerprint(fields)
        : buildScoringDriverFingerprint(fields, true);
    const list = map.get(fp) ?? [];
    list.push(row);
    map.set(fp, list);
  }

  const groups: CrossLabGroup[] = [];
  for (const [fingerprint, groupRows] of map) {
    const labs = [...new Set(groupRows.map((r) => r.lab))];
    if (labs.length < 2) continue;

    const scores = groupRows.map((r) => r.recalculatedScore!);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const consistent = max - min <= SCORE_MATCH_TOLERANCE;

    let note: string | undefined;
    if (!consistent && fingerprintKind === "proportion-design") {
      const a = groupRows[0]!.entry.fieldsNormalized;
      const b = groupRows[1]!.entry.fieldsNormalized;
      note =
        labGradeDisagreementNote(a, b) ??
        "Same proportion design inputs but different recalculated scores — investigate scoring drivers.";
    }

    groups.push({
      fingerprint,
      fingerprintKind,
      labs,
      reportNumbers: groupRows.map((r) => r.reportNumber),
      scores,
      consistent,
      note,
    });
  }

  return groups.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}

export function analyzeCrossLabConsistency(
  rows: LpTestRow[],
): CrossLabConsistencyReport {
  const proportionDesignGroups = buildGroups(rows, "proportion-design");
  const fullDriverGroups = buildGroups(rows, "full-scoring-driver");

  return {
    labNeutralScore: LAB_NEUTRAL_SCORE,
    proportionDesignGroups,
    fullDriverGroups,
    proportionInconsistencies: proportionDesignGroups.filter((g) => !g.consistent),
    fullDriverInconsistencies: fullDriverGroups.filter((g) => !g.consistent),
  };
}
