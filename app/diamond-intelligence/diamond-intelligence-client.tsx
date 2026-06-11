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
import {
  postUrlForIngestion,
  UrlIngestClientError,
} from "@/lib/diamond-intelligence/client-url-ingest";
import type { ListingExtraction } from "@/lib/diamond-intelligence/url-ingestion/types";
import { DI_V3_PAGE } from "./components/di-v3-styles";
import LightPerformanceDashboard from "./components/LightPerformanceDashboard";
import LightPerformanceStudioNav from "./components/LightPerformanceStudioNav";
import type { ClientUploadPhase } from "./components/ReportUploadDock";
import type { IngestMode } from "./components/DiamondIntelligenceIngestDock";

export default function DiamondIntelligenceClient() {
  const [ingestMode, setIngestMode] = useState<IngestMode>("url");
  const [uploadPhase, setUploadPhase] = useState<ClientUploadPhase>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [partialListing, setPartialListing] = useState<ListingExtraction | null>(
    null,
  );
  const [partialListingMessage, setPartialListingMessage] = useState<
    string | null
  >(null);

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

  const applyInterpretation = useCallback(
    (interpretation: ClientSafeInterpretationPayload, partial: boolean) => {
      setPartialListing(null);
      setPartialListingMessage(null);
      setMetadata(interpretation.metadata);
      setExtractedFields(interpretation.extractedFields);
      setInterpretationFields(interpretation.interpretationFields);
      setCapability(interpretation.capability);
      setGradeHints(interpretation.gradeHints);
      setUploadStatusNote(
        partial ? interpretation.clientStatusNote ?? null : null,
      );
      setUploadError(null);
      setUploadPhase("idle");
    },
    [],
  );

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setUploadError(null);
    setUploadStatusNote(null);
    setPartialListing(null);
    setPartialListingMessage(null);
    setUploadPhase("reading");

    const checkingTimer = window.setTimeout(() => {
      setUploadPhase((p) => (p === "reading" ? "checking" : p));
    }, 2800);

    try {
      const { interpretation, partial } = await postReportForInterpretation(file);
      setUploadPhase("building");
      applyInterpretation(interpretation, partial);
    } catch {
      setUploadStatusNote(null);
      setUploadError(CLIENT_UPLOAD_INTERPRET_ERROR);
      setUploadPhase("error");
    } finally {
      window.clearTimeout(checkingTimer);
    }
  }, [applyInterpretation]);

  const processUrl = useCallback(async (url: string) => {
    setFileName(null);
    setUploadError(null);
    setUploadStatusNote(null);
    setPartialListing(null);
    setPartialListingMessage(null);
    setMetadata(null);
    setExtractedFields(null);
    setInterpretationFields(null);
    setCapability(null);
    setGradeHints(undefined);
    setUploadPhase("reading");

    const checkingTimer = window.setTimeout(() => {
      setUploadPhase((p) => (p === "reading" ? "checking" : p));
    }, 2800);

    try {
      const result = await postUrlForIngestion(url);
      if (result.kind === "partial_listing") {
        setPartialListing(result.listing);
        setPartialListingMessage(result.message);
        setUploadPhase("idle");
        return;
      }

      setUploadPhase("building");
      setFileName(result.listing.canonicalUrl);
      applyInterpretation(result.interpretation, result.partial);
    } catch (err) {
      setUploadStatusNote(null);
      if (err instanceof UrlIngestClientError) {
        setUploadError(err.message);
      } else {
        setUploadError(CLIENT_UPLOAD_INTERPRET_ERROR);
      }
      setUploadPhase("error");
    } finally {
      window.clearTimeout(checkingTimer);
    }
  }, [applyInterpretation]);

  function handleInterpretationUpdate(snapshot: ClientInterpretationSnapshot) {
    setInterpretationFields(snapshot.interpretationFields);
    setCapability(reassessClientCapability(snapshot.interpretationFields));
  }

  return (
    <div className={DI_V3_PAGE}>
      <LightPerformanceStudioNav />

      <LightPerformanceDashboard
        ingestMode={ingestMode}
        onIngestModeChange={setIngestMode}
        fileName={fileName}
        uploadPhase={uploadPhase}
        uploadError={uploadError}
        uploadStatusNote={uploadStatusNote}
        onFile={(f) => void processFile(f)}
        onUrl={(url) => void processUrl(url)}
        onClearError={clearUploadError}
        metadata={metadata}
        extractedFields={extractedFields}
        interpretationFields={interpretationFields}
        capability={capability}
        gradeHints={gradeHints}
        partialListing={partialListing}
        partialListingMessage={partialListingMessage}
        onInterpretationUpdate={handleInterpretationUpdate}
      />
    </div>
  );
}
