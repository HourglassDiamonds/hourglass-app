import { extractFieldsFromReportText } from "@/lib/calibration-library/extract-from-text";
import { verifyCalibrationAccess } from "@/lib/calibration-library/auth";
import { saveUpload } from "@/lib/calibration-library/workbook";
import type { ReportSource, StoneType } from "@/lib/calibration-library/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifyCalibrationAccess(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as {
      text?: string;
      lab?: string;
      reportNumber?: string;
      reportUrl?: string;
      reportSource?: ReportSource;
      stoneType?: StoneType;
    };
    const result = extractFieldsFromReportText(body.text ?? "", {
      lab: body.lab,
      reportNumber: body.reportNumber,
      reportUrl: body.reportUrl,
      reportSource: body.reportSource,
      stoneType: body.stoneType,
    });
    return NextResponse.json(result);
  }

  const form = await request.formData();
  const lab = String(form.get("lab") ?? "").trim();
  const reportNumber = String(form.get("reportNumber") ?? "").trim();
  const reportUrl = String(form.get("reportUrl") ?? "").trim();
  const reportSource = String(form.get("reportSource") ?? "manual").trim() as ReportSource;
  const stoneType = String(form.get("stoneType") ?? "unknown").trim() as StoneType;
  const pastedText = String(form.get("text") ?? "").trim();
  const file = form.get("file");

  let storedFilename: string | undefined;
  if (file instanceof File && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    storedFilename = await saveUpload(file.name, buf);
  }

  const result = extractFieldsFromReportText(pastedText, {
    lab,
    reportNumber,
    reportUrl: reportUrl || undefined,
    reportSource,
    stoneType,
  });
  return NextResponse.json({ ...result, storedFilename });
}
