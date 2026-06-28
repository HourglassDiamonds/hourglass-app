"use client";

import { useCallback, useState } from "react";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import {
  CLIENT_UPLOAD_INTERPRET_ERROR,
  isDiamondIntelligenceUploadError,
  postReportForInterpretation,
  reassessClientCapability,
  type ClientInterpretationSnapshot,
  type ClientSafeInterpretationPayload,
} from "@/lib/diamond-intelligence";
import type { DiamondIntelligenceUploadErrorKind } from "@/lib/diamond-intelligence/upload-format-policy";
import { DI_V3_PAGE } from "./components/di-v3-styles";
import LightPerformanceDashboard from "./components/LightPerformanceDashboard";
import LightPerformanceStudioNav from "./components/LightPerformanceStudioNav";
import type { ClientUploadPhase } from "./components/ReportUploadDock";
import type { ReportUploadMimeHint } from "./components/di-v3-upload-hints";
import { mergeReportUploadMimeHint } from "./components/di-v3-upload-hints";

export default function DiamondIntelligenceClient() {
  const [uploadPhase, setUploadPhase] = useState<ClientUploadPhase>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadErrorKind, setUploadErrorKind] =
    useState<DiamondIntelligenceUploadErrorKind | null>(null);
  const [uploadRetryAfterSeconds, setUploadRetryAfterSeconds] = useState<
    number | null
  >(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadMimeHint, setUploadMimeHint] =
    useState<ReportUploadMimeHint | null>(null);

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
    setUploadErrorKind((prev) => (prev ? null : prev));
    setUploadRetryAfterSeconds((prev) => (prev != null ? null : prev));
    setUploadPhase((p) => (p === "error" ? "idle" : p));
  }, []);

  const clearInterpretationState = useCallback(() => {
    setMetadata(null);
    setExtractedFields(null);
    setInterpretationFields(null);
    setCapability(null);
    setGradeHints(undefined);
  }, []);

  const applyInterpretation = useCallback(
    (interpretation: ClientSafeInterpretationPayload, partial: boolean) => {
      setMetadata(interpretation.metadata);
      setExtractedFields(interpretation.extractedFields);
      setInterpretationFields(interpretation.interpretationFields);
      setCapability(interpretation.capability);
      setGradeHints(interpretation.gradeHints);
      setUploadStatusNote(
        partial ? interpretation.clientStatusNote ?? null : null,
      );
      setUploadError(null);
      setUploadErrorKind(null);
      setUploadRetryAfterSeconds(null);
      setUploadPhase("idle");
    },
    [],
  );

  const processFile = useCallback(async (file: File) => {
    clearInterpretationState();
    const clientMimeHint: ReportUploadMimeHint = {
      mime: file.type || null,
      fileName: file.name,
    };
    setFileName(file.name);
    setUploadFileName(file.name);
    setUploadMimeHint(clientMimeHint);
    setUploadError(null);
    setUploadErrorKind(null);
    setUploadRetryAfterSeconds(null);
    setUploadStatusNote(null);
    setUploadPhase("reading");

    const checkingTimer = window.setTimeout(() => {
      setUploadPhase((p) => (p === "reading" ? "checking" : p));
    }, 2800);

    try {
      const { interpretation, partial } = await postReportForInterpretation(file);
      setUploadPhase("building");
      applyInterpretation(interpretation, partial);
    } catch (err) {
      clearInterpretationState();
      setUploadStatusNote(null);
      if (isDiamondIntelligenceUploadError(err)) {
        setUploadError(err.message);
        setUploadErrorKind(err.kind);
        setUploadRetryAfterSeconds(
          err.kind === "rate_limited" ? (err.retryAfterSeconds ?? null) : null,
        );
        setUploadMimeHint(
          mergeReportUploadMimeHint(clientMimeHint, err.uploadMeta),
        );
      } else {
        setUploadError(
          err instanceof Error && err.message.trim()
            ? err.message
            : CLIENT_UPLOAD_INTERPRET_ERROR,
        );
        setUploadErrorKind("interpret_failure");
        setUploadRetryAfterSeconds(null);
        setUploadMimeHint(clientMimeHint);
      }
      setUploadPhase("error");
    } finally {
      window.clearTimeout(checkingTimer);
    }
  }, [applyInterpretation, clearInterpretationState]);

  function handleInterpretationUpdate(snapshot: ClientInterpretationSnapshot) {
    setInterpretationFields(snapshot.interpretationFields);
    setCapability(reassessClientCapability(snapshot.interpretationFields));
  }

  return (
    <div className={DI_V3_PAGE}>
      <LightPerformanceStudioNav />

      <LightPerformanceDashboard
        fileName={fileName}
        uploadPhase={uploadPhase}
        uploadError={uploadError}
        uploadErrorKind={uploadErrorKind}
        uploadRetryAfterSeconds={uploadRetryAfterSeconds}
        uploadStatusNote={uploadStatusNote}
        onFile={(f) => void processFile(f)}
        onClearError={clearUploadError}
        metadata={metadata}
        extractedFields={extractedFields}
        interpretationFields={interpretationFields}
        capability={capability}
        gradeHints={gradeHints}
        uploadFileName={uploadFileName}
        uploadMimeHint={uploadMimeHint}
        onInterpretationUpdate={handleInterpretationUpdate}
      />
    </div>
  );
}
