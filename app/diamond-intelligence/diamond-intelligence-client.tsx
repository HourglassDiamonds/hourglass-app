"use client";

import { useCallback, useState } from "react";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import {
  CLIENT_UPLOAD_INTERPRET_ERROR,
  postReportForInterpretation,
  reassessClientCapability,
  type ClientInterpretationSnapshot,
  type ClientSafeInterpretationPayload,
} from "@/lib/diamond-intelligence";
import LightPerformanceDashboard from "./components/LightPerformanceDashboard";
import LightPerformanceStudioNav from "./components/LightPerformanceStudioNav";
import type { ClientUploadPhase } from "./components/ReportUploadDock";

export default function DiamondIntelligenceClient() {
  const [uploadPhase, setUploadPhase] = useState<ClientUploadPhase>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const [extractedFields, setExtractedFields] =
    useState<CalibrationReportFields | null>(null);
  const [interpretationFields, setInterpretationFields] =
    useState<CalibrationReportFields | null>(null);
  const [capability, setCapability] =
    useState<ClientSafeInterpretationPayload["capability"] | null>(null);
  const [metadata, setMetadata] =
    useState<ClientSafeInterpretationPayload["metadata"] | null>(null);
  const [uploadStatusNote, setUploadStatusNote] = useState<string | null>(
    null,
  );
  const [gradeHints, setGradeHints] =
    useState<ClientSafeInterpretationPayload["gradeHints"]>(undefined);

  const clearUploadError = useCallback(() => {
    setUploadError((prev) => (prev ? null : prev));
    setUploadPhase((p) => (p === "error" ? "idle" : p));
  }, []);

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setUploadError(null);
    setUploadStatusNote(null);
    setUploadPhase("reading");

    const checkingTimer = window.setTimeout(() => {
      setUploadPhase((p) => (p === "reading" ? "checking" : p));
    }, 2800);

    try {
      const { interpretation, partial } = await postReportForInterpretation(file);
      setUploadPhase("building");

      setMetadata(interpretation.metadata);
      setExtractedFields(interpretation.extractedFields);
      setInterpretationFields(interpretation.interpretationFields);
      setCapability(interpretation.capability);
      setGradeHints(interpretation.gradeHints);
      // HTTP 200 full OR partial are both successes — never an error.
      setUploadStatusNote(
        partial ? interpretation.clientStatusNote ?? null : null,
      );
      setUploadError(null);
      setUploadPhase("idle");
    } catch {
      // Only a failed current attempt surfaces calm error copy.
      setUploadStatusNote(null);
      setUploadError(CLIENT_UPLOAD_INTERPRET_ERROR);
      setUploadPhase("error");
    } finally {
      window.clearTimeout(checkingTimer);
    }
  }, []);

  function handleInterpretationUpdate(snapshot: ClientInterpretationSnapshot) {
    setInterpretationFields(snapshot.interpretationFields);
    setCapability(reassessClientCapability(snapshot.interpretationFields));
  }

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#1c1b1a]">
      <LightPerformanceStudioNav />

      <LightPerformanceDashboard
        fileName={fileName}
        uploadPhase={uploadPhase}
        uploadError={uploadError}
        uploadStatusNote={uploadStatusNote}
        onFile={(f) => void processFile(f)}
        onClearError={clearUploadError}
        metadata={metadata}
        extractedFields={extractedFields}
        interpretationFields={interpretationFields}
        capability={capability}
        gradeHints={gradeHints}
        onInterpretationUpdate={handleInterpretationUpdate}
      />
    </div>
  );
}
