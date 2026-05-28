"use client";

import { useCallback, useState } from "react";
import type { CalibrationReportFields } from "@/lib/calibration-library/types";
import {
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

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setUploadError(null);
    setUploadPhase("reading");

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/diamond-intelligence/interpret", {
        method: "POST",
        body: fd,
      });

      setUploadPhase("building");
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        interpretation?: ClientSafeInterpretationPayload;
      };

      if (!res.ok || !data.ok || !data.interpretation) {
        throw new Error(
          data.error ??
            "We couldn't read enough from this file to build a useful interpretation. You can try another report image or PDF, or send it to Justin for review.",
        );
      }

      const payload = data.interpretation;
      setMetadata(payload.metadata);
      setExtractedFields(payload.extractedFields);
      setInterpretationFields(payload.interpretationFields);
      setCapability(payload.capability);
    } catch (e) {
      setUploadError(
        e instanceof Error
          ? e.message
          : "We couldn't read enough from this file to build a useful interpretation. You can try another report image or PDF, or send it to Justin for review.",
      );
    } finally {
      setUploadPhase("idle");
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
        onFile={(f) => void processFile(f)}
        metadata={metadata}
        extractedFields={extractedFields}
        interpretationFields={interpretationFields}
        capability={capability}
        onInterpretationUpdate={handleInterpretationUpdate}
      />
    </div>
  );
}
