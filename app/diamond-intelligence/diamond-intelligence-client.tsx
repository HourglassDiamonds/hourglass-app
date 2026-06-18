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
import { resolveUrlIngestUploadErrorKind } from "@/lib/diamond-intelligence/url-ingestion/listing-access-error";
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
  const [uploadErrorKind, setUploadErrorKind] =
    useState<DiamondIntelligenceUploadErrorKind | null>(null);
  const [uploadRetryAfterSeconds, setUploadRetryAfterSeconds] = useState<
    number | null
  >(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [partialListing, setPartialListing] = useState<ListingExtraction | null>(
    null,
  );
  const [partialListingMessage, setPartialListingMessage] = useState<
    string | null
  >(null);
  const [activeListing, setActiveListing] = useState<ListingExtraction | null>(
    null,
  );
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);

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
      setUploadErrorKind(null);
      setUploadRetryAfterSeconds(null);
      setUploadPhase("idle");
    },
    [],
  );

  const processFile = useCallback(async (file: File) => {
    clearInterpretationState();
    setFileName(file.name);
    setUploadFileName(file.name);
    setSourceUrl(null);
    setActiveListing(null);
    setUploadError(null);
    setUploadErrorKind(null);
    setUploadRetryAfterSeconds(null);
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
    } catch (err) {
      clearInterpretationState();
      setUploadStatusNote(null);
      if (isDiamondIntelligenceUploadError(err)) {
        setUploadError(err.message);
        setUploadErrorKind(err.kind);
        setUploadRetryAfterSeconds(
          err.kind === "rate_limited" ? (err.retryAfterSeconds ?? null) : null,
        );
      } else {
        setUploadError(
          err instanceof Error && err.message.trim()
            ? err.message
            : CLIENT_UPLOAD_INTERPRET_ERROR,
        );
        setUploadErrorKind("interpret_failure");
        setUploadRetryAfterSeconds(null);
      }
      setUploadPhase("error");
    } finally {
      window.clearTimeout(checkingTimer);
    }
  }, [applyInterpretation, clearInterpretationState]);

  const processUrl = useCallback(async (url: string) => {
    clearInterpretationState();
    setFileName(null);
    setUploadFileName(null);
    setSourceUrl(url.trim());
    setUploadError(null);
    setUploadErrorKind(null);
    setUploadRetryAfterSeconds(null);
    setUploadStatusNote(null);
    setPartialListing(null);
    setPartialListingMessage(null);
    setActiveListing(null);
    setUploadPhase("reading");

    const checkingTimer = window.setTimeout(() => {
      setUploadPhase((p) => (p === "reading" ? "checking" : p));
    }, 2800);

    try {
      const result = await postUrlForIngestion(url);
      if (result.kind === "partial_listing") {
        setPartialListing(result.listing);
        setActiveListing(result.listing);
        setPartialListingMessage(result.message);
        setUploadPhase("idle");
        return;
      }

      setUploadPhase("building");
      setFileName(result.listing.canonicalUrl);
      setActiveListing(result.listing);
      applyInterpretation(result.interpretation, result.partial);
    } catch (err) {
      clearInterpretationState();
      setUploadStatusNote(null);
      if (err instanceof UrlIngestClientError) {
        setUploadError(err.message);
        setUploadErrorKind(
          resolveUrlIngestUploadErrorKind(err.status, err.message),
        );
      } else {
        setUploadError(CLIENT_UPLOAD_INTERPRET_ERROR);
        setUploadErrorKind("interpret_failure");
      }
      setUploadRetryAfterSeconds(null);
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
        ingestMode={ingestMode}
        onIngestModeChange={setIngestMode}
        fileName={fileName}
        uploadPhase={uploadPhase}
        uploadError={uploadError}
        uploadErrorKind={uploadErrorKind}
        uploadRetryAfterSeconds={uploadRetryAfterSeconds}
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
        activeListing={activeListing}
        sourceUrl={sourceUrl}
        uploadFileName={uploadFileName}
        onInterpretationUpdate={handleInterpretationUpdate}
      />
    </div>
  );
}
