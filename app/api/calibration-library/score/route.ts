import { scoreRoundBrilliant } from "@/lib/calibration-library/scoring/round-brilliant";
import { verifyCalibrationAccess } from "@/lib/calibration-library/auth";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!verifyCalibrationAccess(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { fields?: CalibrationReportFields };
  if (!body.fields) {
    return NextResponse.json({ error: "fields required" }, { status: 400 });
  }

  return NextResponse.json({
    score: scoreRoundBrilliant(body.fields),
  });
}
