import { verifyCalibrationAccess } from "@/lib/calibration-library/auth";
import { toJsonSafe } from "@/lib/calibration-library/gcal-api-error";
import {
  listCalibrationEntries,
  saveCalibrationEntry,
} from "@/lib/calibration-library/storage";
import type {
  CalibrationExtractionSnapshot,
  CalibrationReportFields,
  CalibrationReportMetadata,
  CalibrationSaveMode,
  FieldConfidence,
  ReportFieldKey,
} from "@/lib/calibration-library/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(toJsonSafe(body), { status });
}

export async function GET(request: Request) {
  if (!verifyCalibrationAccess(request)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? "50");
    const entries = await listCalibrationEntries(limit);
    return jsonResponse({
      ok: true,
      entries,
      total: entries.length,
      storage: process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "filesystem",
    });
  } catch (e) {
    return jsonResponse(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Failed to list entries",
      },
      500,
    );
  }
}

export async function POST(request: Request) {
  if (!verifyCalibrationAccess(request)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const body = (await request.json()) as {
      metadata: CalibrationReportMetadata;
      fields: CalibrationReportFields;
      confidence: Record<ReportFieldKey, FieldConfidence>;
      extractionSnapshot?: CalibrationExtractionSnapshot;
      sourceFilename?: string;
      reviewerNote?: string;
      saveMode?: CalibrationSaveMode;
      valueProvenance?: import("@/lib/calibration-library/extraction-provenance").ValueProvenanceMap;
    };

    if (!body.metadata?.reportNumber?.trim() || !body.metadata?.lab) {
      return jsonResponse(
        {
          ok: false,
          error: "metadata.lab and metadata.reportNumber are required before saving",
        },
        400,
      );
    }

    const extractionSnapshot: CalibrationExtractionSnapshot =
      body.extractionSnapshot ?? {
        fields: body.fields,
        confidence: body.confidence,
        warnings: [],
      };

    const result = await saveCalibrationEntry({
      metadata: body.metadata,
      fields: body.fields,
      confidence: body.confidence,
      extractionSnapshot,
      sourceFilename: body.sourceFilename,
      reviewerNote: body.reviewerNote,
      saveMode: body.saveMode ?? "create",
      valueProvenance: body.valueProvenance,
    });

    if (!result.ok) {
      return jsonResponse(
        {
          ok: false,
          code: result.code,
          error: result.message,
          existing: result.existing,
        },
        409,
      );
    }

    return jsonResponse({
      ok: true,
      entry: result.entry,
      created: result.created,
    });
  } catch (e) {
    return jsonResponse(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Save failed",
      },
      500,
    );
  }
}
