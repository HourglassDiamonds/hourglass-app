import type { Metadata } from "next";
import { buildDistributionCalibrationReport } from "@/lib/calibration-library/distribution-calibration";
import { buildCalibrationReviewReport } from "@/lib/calibration-library/light-performance-calibration-review";
import { analyzeCrossLabConsistency } from "@/lib/calibration-library/light-performance-cross-lab";
import {
  buildLpTestRows,
  summarizeLpTestRows,
} from "@/lib/calibration-library/light-performance-test-rows";
import { listCalibrationEntries } from "@/lib/calibration-library/storage";
import { isCalibrationDatabaseAvailable } from "@/lib/supabase/calibration";
import LpTestConsole from "./lp-test-console";

export const metadata: Metadata = {
  title: "LP Calibration Review Console",
  description:
    "Internal Light Performance score calibration review against seeded records.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LightPerformanceTestPage() {
  const entries = await listCalibrationEntries(500);
  const rows = buildLpTestRows(entries);
  const summary = summarizeLpTestRows(rows);
  const crossLab = analyzeCrossLabConsistency(rows);
  const calibrationReview = buildCalibrationReviewReport(rows);
  const distributionCalibration = buildDistributionCalibrationReport({
    rows,
    reviews: calibrationReview.reviews,
    distribution: calibrationReview.distribution,
  });
  const storageBackend = isCalibrationDatabaseAvailable()
    ? "supabase"
    : "filesystem";

  return (
    <LpTestConsole
      rows={rows}
      summary={summary}
      crossLab={crossLab}
      calibrationReview={calibrationReview}
      distributionCalibration={distributionCalibration}
      storageBackend={storageBackend}
    />
  );
}
