"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "../shared-components/Header";
import {
  FIELD_LABELS,
  METADATA_LABELS,
  emptyReportFields,
} from "@/lib/calibration-library/fields";
import { normalizeCalibrationLab } from "@/lib/calibration-library/extract-from-text";
import ReportUploadZone, {
  type ExtractionStatus,
} from "./report-upload-zone";
import {
  buildManualOverrideReview,
  MANUAL_PROPORTION_WARNING,
} from "@/lib/calibration-library/manual-override-safety";
import {
  fieldInputPlaceholder,
  provenanceDetailLabel,
  textMethodReviewLabel,
} from "@/lib/calibration-library/review-guidance";
import type { CalibrationSafetyAssessment } from "@/lib/calibration-library/calibration-safety";
import {
  CALIBRATION_LABS,
  REPORT_FIELD_KEYS,
  STONE_TYPES,
  type CalibrationReportFields,
  type CalibrationReportMetadata,
  type CalibrationExtractionSnapshot,
  type ExtractionResult,
  type FieldConfidence,
  type ReportFieldKey,
  type ReportSource,
  type RoundBrilliantScoreResult,
  type StoneType,
  type TextExtractionMethod,
} from "@/lib/calibration-library/types";

const SURFACE = "rounded-sm border border-[#e4dbcf]/62 bg-white/40";
const INPUT =
  "mt-1.5 w-full rounded-sm border border-[#e4dbcf]/80 bg-white/70 px-3 py-2 text-sm text-[#1f1d1a] outline-none focus:border-[#b8a99a]";

type Step = "upload" | "review" | "done";

function getInternalSecret(): string {
  if (typeof window === "undefined") return "";
  const fromUrl = new URLSearchParams(window.location.search).get("secret");
  if (fromUrl) {
    sessionStorage.setItem("calibration_secret", fromUrl);
    return fromUrl;
  }
  return sessionStorage.getItem("calibration_secret") ?? "";
}

function authHeaders(): HeadersInit {
  const secret = getInternalSecret();
  if (!secret) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    "x-cron-secret": secret,
  };
}

function authHeadersMultipart(): HeadersInit {
  const secret = getInternalSecret();
  return secret ? { "x-cron-secret": secret } : {};
}

function confidenceBadge(level: FieldConfidence) {
  const styles: Record<FieldConfidence, string> = {
    high: "bg-[#e8f0e6] text-[#3d5c38]",
    medium: "bg-[#f5f0e8] text-[#6b5c48]",
    low: "bg-[#f8ece8] text-[#8a4a3a]",
    manual: "bg-[#eeeae4] text-[#6a6258]",
    missing: "bg-[#f0e4e4] text-[#8a3a3a]",
  };
  return (
    <span
      className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${styles[level]}`}
    >
      {level}
    </span>
  );
}

function inferReportSource(file: File | null, pastedText: string): ReportSource {
  if (file?.type === "application/pdf") return "pdf-upload";
  if (file?.type.startsWith("image/")) return "screenshot-upload";
  if (pastedText.trim()) return "manual";
  return "manual";
}

const EMPTY_METADATA = (): CalibrationReportMetadata => ({
  lab: "OTHER",
  reportNumber: "",
  reportSource: "manual",
  stoneType: "unknown",
});

function fieldInputClass(confidence: FieldConfidence): string {
  const base = INPUT;
  if (confidence === "missing") {
    return `${base} border-[#d4a5a5]/90 bg-[#fdf8f8]`;
  }
  if (confidence === "low") {
    return `${base} border-[#e8d4b8]/90 bg-[#fdfaf5]`;
  }
  return base;
}

export default function IngestClient() {
  const [step, setStep] = useState<Step>("upload");
  const [metadata, setMetadata] = useState<CalibrationReportMetadata>(EMPTY_METADATA);
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [pipelineNotices, setPipelineNotices] = useState<string[]>([]);
  const [extractionStatus, setExtractionStatus] =
    useState<ExtractionStatus>("idle");
  const [textMethod, setTextMethod] = useState<TextExtractionMethod | null>(
    null,
  );
  const [fields, setFields] = useState<CalibrationReportFields>(() =>
    emptyReportFields(),
  );
  const [confidence, setConfidence] = useState<
    Record<ReportFieldKey, FieldConfidence>
  >(() =>
    Object.fromEntries(
      REPORT_FIELD_KEYS.map((k) => [k, "manual" as FieldConfidence]),
    ) as Record<ReportFieldKey, FieldConfidence>,
  );
  const [warnings, setWarnings] = useState<string[]>([]);
  const [storedFilename, setStoredFilename] = useState<string | undefined>();
  const [score, setScore] = useState<RoundBrilliantScoreResult | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");
  const [extractionSnapshot, setExtractionSnapshot] =
    useState<CalibrationExtractionSnapshot | null>(null);
  const [fieldProvenance, setFieldProvenance] =
    useState<ExtractionResult["fieldProvenance"]>(undefined);
  const [calibrationEligible, setCalibrationEligible] = useState<
    boolean | null
  >(null);
  const [excludedFromCalibrationStats, setExcludedFromCalibrationStats] =
    useState<boolean | null>(null);
  const [calibrationSafety, setCalibrationSafety] =
    useState<CalibrationSafetyAssessment | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const secretMissing = useMemo(
    () =>
      typeof window !== "undefined" &&
      process.env.NODE_ENV === "production" &&
      !getInternalSecret(),
    [],
  );

  const updateMeta = <K extends keyof CalibrationReportMetadata>(
    key: K,
    value: CalibrationReportMetadata[K],
  ) => {
    setMetadata((prev) => ({ ...prev, [key]: value }));
  };

  const updateField = (key: ReportFieldKey, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const manualReview = useMemo(
    () =>
      buildManualOverrideReview({
        approvedFields: fields,
        extractionSnapshot,
      }),
    [fields, extractionSnapshot],
  );

  const refreshScore = useCallback(async (next: CalibrationReportFields) => {
    try {
      const res = await fetch("/api/calibration-library/score", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ fields: next }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { score: RoundBrilliantScoreResult };
      setScore(data.score);
    } catch {
      /* preview optional */
    }
  }, []);

  useEffect(() => {
    if (step !== "review") return;
    const t = setTimeout(() => {
      void refreshScore(fields);
    }, 400);
    return () => clearTimeout(t);
  }, [fields, step, refreshScore]);

  function applyExtractionPayload(
    data: ExtractionResult & {
      storedFilename?: string;
      pipelineNotices?: string[];
      textMethod?: string;
      calibrationEligible?: boolean;
      excludedFromCalibrationStats?: boolean;
      calibrationSafety?: CalibrationSafetyAssessment;
    },
    source: ReportSource,
  ) {
    setMetadata({
      ...data.metadata,
      reportSource: source,
    });
    setFields(data.fields);
    setConfidence(data.confidence);
    setExtractionSnapshot({
      fields: data.fields,
      confidence: data.confidence,
      parserType: data.parserType,
      parserConfidence: data.parserConfidence,
      textMethod: data.textMethod,
      warnings: data.warnings,
      parserMetadata: {
        parserType: data.parserType,
        parserConfidence: data.parserConfidence,
        textMethod: data.textMethod,
        extractionMeta: data.extractionMeta,
        igiInternal: data.igiInternal,
        giaInternal: data.giaInternal,
        gcalInternal: data.gcalInternal,
        fieldProvenance: data.fieldProvenance,
      },
    });
    setFieldProvenance(data.fieldProvenance);
    setWarnings(data.warnings);
    setCalibrationEligible(data.calibrationEligible ?? null);
    setExcludedFromCalibrationStats(data.excludedFromCalibrationStats ?? null);
    setCalibrationSafety(data.calibrationSafety ?? null);
    if (data.storedFilename) setStoredFilename(data.storedFilename);
    if (data.pipelineNotices?.length) setPipelineNotices(data.pipelineNotices);
    if (data.textMethod) setTextMethod(data.textMethod);
    setExtractionStatus("ready");
    setStep("review");
  }

  async function runExtraction(text: string, source: ReportSource) {
    setExtracting(true);
    setExtractError(null);
    setExtractionStatus("parsing");
    try {
      const res = await fetch("/api/calibration-library/extract", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ text, reportSource: source }),
      });
      const data = (await res.json()) as ExtractionResult & {
        error?: string;
        storedFilename?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Extraction failed");
      }
      applyExtractionPayload(data, source);
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : "Extraction failed");
      setExtractionStatus("error");
    } finally {
      setExtracting(false);
    }
  }

  async function processReportFile(
    reportFile: File,
    pasteOverride?: string,
  ) {
    const source = inferReportSource(reportFile, pasteOverride ?? pastedText);
    setExtracting(true);
    setExtractError(null);
    setPipelineNotices([]);
    setExtractionStatus(
      reportFile.type.includes("pdf") ? "pdf-text" : "ocr",
    );

    const fd = new FormData();
    fd.append("file", reportFile);
    fd.append("pastedText", pasteOverride ?? pastedText);
    fd.append("lab", metadata.lab);
    fd.append("reportNumber", metadata.reportNumber);
    if (metadata.reportUrl) fd.append("reportUrl", metadata.reportUrl);
    fd.append("reportSource", source);
    fd.append("stoneType", metadata.stoneType);

    try {
      const res = await fetch("/api/calibration-library/extract-file", {
        method: "POST",
        headers: authHeadersMultipart(),
        body: fd,
      });
      const data = (await res.json()) as ExtractionResult & {
        error?: string;
        storedFilename?: string;
        pipelineNotices?: string[];
        textMethod?: string;
        ocrAttempted?: boolean;
        calibrationEligible?: boolean;
        excludedFromCalibrationStats?: boolean;
        calibrationSafety?: CalibrationSafetyAssessment;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "File extraction failed");
      }

      if (data.textMethod === "ocr") setExtractionStatus("ocr");
      setExtractionStatus("parsing");
      applyExtractionPayload(data, source);
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : "Extraction failed");
      setExtractionStatus("error");
    } finally {
      setExtracting(false);
    }
  }

  const handleFileSelected = useCallback((f: File) => {
    setFile(f);
    void processReportFile(f);
  }, [pastedText]);

  async function handleUploadContinue() {
    const source = inferReportSource(file, pastedText);
    setExtractError(null);
    setPipelineNotices([]);

    if (file) {
      await processReportFile(file, pastedText);
      return;
    }

    await runExtraction(pastedText.trim(), source);
  }

  async function handleSave() {
    if (!metadata.reportNumber.trim()) {
      setSaveError("Report number is required before saving.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/calibration-library/entries", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          metadata: {
            ...metadata,
            lab: normalizeCalibrationLab(metadata.lab),
          },
          fields,
          confidence,
          extractionSnapshot: extractionSnapshot ?? {
            fields,
            confidence,
            warnings,
          },
          valueProvenance: manualReview.valueProvenance,
          sourceFilename: storedFilename ?? file?.name,
          reviewerNote: reviewerNote.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        entry?: { id: string };
        error?: string;
        code?: string;
        existing?: { id: string };
      };
      if (res.status === 409 && data.code === "duplicate") {
        throw new Error(
          data.error ??
            `This report is already saved (${data.existing?.id ?? "duplicate"}).`,
        );
      }
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSavedId(data.entry?.id ?? null);
      setStep("done");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function resetWorkflow() {
    setStep("upload");
    setMetadata(EMPTY_METADATA());
    setFile(null);
    setPastedText("");
    setFields(emptyReportFields());
    setConfidence(
      Object.fromEntries(
        REPORT_FIELD_KEYS.map((k) => [k, "manual" as FieldConfidence]),
      ) as Record<ReportFieldKey, FieldConfidence>,
    );
    setWarnings([]);
    setScore(null);
    setSavedId(null);
    setSaveError(null);
    setStoredFilename(undefined);
    setPipelineNotices([]);
    setExtractionStatus("idle");
    setTextMethod(null);
    setExtractError(null);
    setExtractionSnapshot(null);
    setFieldProvenance(undefined);
    setCalibrationEligible(null);
    setExcludedFromCalibrationStats(null);
    setCalibrationSafety(null);
  }

  const reviewGuidanceNotices = useMemo(() => {
    const status = warnings.filter(
      (w) =>
        w.startsWith("Text source:") || w.startsWith("Calibration status:"),
    );
    const guidance = warnings.filter(
      (w) =>
        !status.includes(w) &&
        !w.startsWith("GIA facsimile:") &&
        !w.startsWith("GCAL Sarine (4Cs): parser") &&
        !w.startsWith("Sarine router") &&
        !w.startsWith("Proportion diagram not captured") &&
        !w.startsWith("Report number missing") &&
        !w.startsWith("No report text") &&
        !w.startsWith("No specialized report") &&
        !w.startsWith("IGI: if the report") &&
        !w.includes("parser confidence is low"),
    );
    const parserNotices = warnings.filter(
      (w) => !status.includes(w) && !guidance.includes(w),
    );
    return { status, guidance, parserNotices };
  }, [warnings]);

  const proportionDims = score?.dimensions.filter((d) => d.group === "proportion");
  const finishDims = score?.dimensions.filter((d) => d.group === "reported-finish");

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#1f1d1a]">
      <Header />
      <div className="mx-auto max-w-3xl px-6 py-14 md:py-16">
        <p className="text-[10px] uppercase tracking-[0.34em] text-[#948a80]">
          Internal · Light Performance Calibration Library
        </p>
        <h1 className="mt-3 font-serif text-[2rem] font-normal tracking-[-0.02em] text-[#1f1c19] md:text-[2.35rem]">
          Calibration library
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#5f5851]">
          Drop a lab report to extract fields automatically, review everything once,
          then save. Lab-neutral scoring — laboratory is context only.
        </p>

        {secretMissing ? (
          <p className={`mt-6 ${SURFACE} px-4 py-3 text-sm text-[#8a4a3a]`}>
            Production writes require{" "}
            <code className="text-xs">?secret=CRON_SECRET</code> once per
            browser session.
          </p>
        ) : null}

        <div className="mt-8 flex gap-3 text-[10px] uppercase tracking-[0.28em] text-[#948a80]">
          {(
            [
              { id: "upload" as const, label: "Upload" },
              { id: "review" as const, label: "Review" },
              { id: "done" as const, label: "Saved" },
            ] as const
          ).map((s) => (
            <span
              key={s.id}
              className={step === s.id ? "text-[#1f1c19]" : "opacity-45"}
            >
              {s.label}
            </span>
          ))}
        </div>

        {step === "upload" && (
          <section className={`mt-8 ${SURFACE} p-6 md:p-8`}>
            <ReportUploadZone
              file={file}
              status={
                extracting ? extractionStatus : file ? extractionStatus : "idle"
              }
              disabled={extracting}
              onFile={handleFileSelected}
              className=""
            />
            <details className="mt-8 group">
              <summary className="cursor-pointer text-[10px] uppercase tracking-[0.3em] text-[#948a80]">
                Paste report text instead (difficult scans)
              </summary>
              <textarea
                className={`${INPUT} mt-3 min-h-[120px] font-mono text-xs leading-relaxed`}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste full report text if the file is hard to read…"
              />
            </details>
            {pipelineNotices.map((notice) => (
              <p
                key={notice}
                className={`mt-4 ${SURFACE} px-4 py-3 text-sm leading-relaxed text-[#6b5048]`}
              >
                {notice}
              </p>
            ))}
            {extractError ? (
              <p className="mt-4 text-sm text-[#8a4a3a]">{extractError}</p>
            ) : null}
            {pastedText.trim() && !extracting ? (
              <button
                type="button"
                className="mt-6 rounded-sm border border-[#1f1d1a]/15 px-5 py-2.5 text-[10px] uppercase tracking-[0.28em] text-[#5f5851] hover:border-[#1f1d1a]/30"
                onClick={() => void handleUploadContinue()}
              >
                Parse pasted text & review
              </button>
            ) : null}
          </section>
        )}

        {step === "review" && (
          <section className="mt-8 space-y-6">
            <div className={`${SURFACE} p-6 md:p-8`}>
              <h2 className="font-serif text-xl text-[#1f1c19]">3. Review before save</h2>
              <p className="mt-2 text-sm text-[#5f5851]">
                Confirm metadata and reported values. Saved data is exactly what you
                approve — no official lab grade claims beyond the report.
              </p>
              {reviewGuidanceNotices.status.length > 0 ? (
                <div className="mt-4 space-y-2 rounded-sm border border-[#e4dbcf]/70 bg-[#f7f3ee]/60 px-3 py-3">
                  {reviewGuidanceNotices.status.map((w) => (
                    <p key={w} className="text-sm leading-relaxed text-[#5f5851]">
                      {w}
                    </p>
                  ))}
                  {textMethod ? (
                    <p className="text-[10px] uppercase tracking-[0.24em] text-[#948a80]">
                      Pipeline method: {textMethodReviewLabel(textMethod)}
                    </p>
                  ) : null}
                  {calibrationEligible !== null ? (
                    <p className="text-[10px] leading-relaxed tracking-[0.08em] text-[#847a70]">
                      {calibrationEligible
                        ? "Structural gate: passes calibration eligibility checks on extracted fields."
                        : "Structural gate: does not pass calibration eligibility yet (missing or low-confidence core fields)."}
                      {excludedFromCalibrationStats
                        ? " Excluded from calibration statistics until resolved."
                        : null}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {reviewGuidanceNotices.guidance.map((w) => (
                <p key={w} className="mt-3 text-sm leading-relaxed text-[#5f5851]">
                  {w}
                </p>
              ))}
              {reviewGuidanceNotices.parserNotices.map((w) => (
                <p key={w} className="mt-3 text-sm text-[#6b5048]">
                  {w}
                </p>
              ))}
              {calibrationSafety?.reasons &&
              calibrationSafety.reasons.length > 0 ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[10px] uppercase tracking-[0.26em] text-[#948a80]">
                    Safety detail
                  </summary>
                  <ul className="mt-2 list-inside list-disc text-xs leading-relaxed text-[#847a70]">
                    {calibrationSafety.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {manualReview.hardWarnings.map((w) => (
                <p
                  key={w}
                  className="mt-3 rounded-sm border border-[#d4a5a5]/80 bg-[#fdf8f8] px-3 py-2 text-sm text-[#8a3a3a]"
                >
                  {w}
                </p>
              ))}
              {manualReview.warnings
                .filter((w) => !manualReview.hardWarnings.includes(w))
                .map((w) => (
                  <p key={w} className="mt-2 text-sm text-[#6b5048]">
                    {w}
                  </p>
                ))}
              {!manualReview.includeInCalibrationStats ? (
                <p className="mt-3 text-xs text-[#6b5048]">
                  This record will be saved for review but is not calibration-statistics
                  eligible until manual proportion edits are resolved.
                </p>
              ) : null}

              <h3 className="mt-6 text-[10px] uppercase tracking-[0.3em] text-[#948a80]">
                Report context
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="block text-[10px] uppercase tracking-[0.28em] text-[#948a80]">
                  {METADATA_LABELS.lab}
                  <select
                    className={INPUT}
                    value={metadata.lab}
                    onChange={(e) =>
                      updateMeta("lab", normalizeCalibrationLab(e.target.value))
                    }
                  >
                    {CALIBRATION_LABS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[10px] uppercase tracking-[0.28em] text-[#948a80]">
                  {METADATA_LABELS.reportNumber}
                  <input
                    className={fieldInputClass(
                      metadata.reportNumber.trim() ? "manual" : "missing",
                    )}
                    value={metadata.reportNumber}
                    onChange={(e) => updateMeta("reportNumber", e.target.value)}
                    placeholder="Not detected — enter from report"
                  />
                </label>
                <label className="block text-[10px] uppercase tracking-[0.28em] text-[#948a80] sm:col-span-2">
                  {METADATA_LABELS.reportUrl}
                  <input
                    className={INPUT}
                    value={metadata.reportUrl ?? ""}
                    onChange={(e) =>
                      updateMeta("reportUrl", e.target.value.trim() || undefined)
                    }
                  />
                </label>
                <label className="block text-[10px] uppercase tracking-[0.28em] text-[#948a80]">
                  {METADATA_LABELS.stoneType}
                  <select
                    className={INPUT}
                    value={metadata.stoneType}
                    onChange={(e) =>
                      updateMeta("stoneType", e.target.value as StoneType)
                    }
                  >
                    {STONE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="block text-[10px] uppercase tracking-[0.28em] text-[#948a80]">
                  {METADATA_LABELS.reportSource}
                  <p className={`${INPUT} bg-[#f7f3ee]/80 text-[#5f5851]`}>
                    {metadata.reportSource}
                  </p>
                </div>
              </div>

              <h3 className="mt-8 text-[10px] uppercase tracking-[0.3em] text-[#948a80]">
                Reported proportions & finish
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {REPORT_FIELD_KEYS.map((key) => (
                  <label
                    key={key}
                    className="block text-[10px] uppercase tracking-[0.28em] text-[#948a80]"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-1">
                      {FIELD_LABELS[key]}
                      <span className="flex items-center gap-1">
                        <span className="text-[9px] normal-case tracking-normal text-[#948a80]">
                          {(() => {
                            const manualSrc =
                              manualReview.valueProvenance[key];
                            if (
                              manualSrc === "manual-user" ||
                              manualSrc === "manual-admin"
                            ) {
                              return manualSrc === "manual-user"
                                ? "manual (user)"
                                : "manual (admin)";
                            }
                            return provenanceDetailLabel(
                              fieldProvenance?.[key],
                            );
                          })()}
                        </span>
                        {confidenceBadge(confidence[key])}
                      </span>
                    </span>
                    <input
                      className={fieldInputClass(confidence[key])}
                      value={fields[key]}
                      placeholder={fieldInputPlaceholder(
                        confidence[key],
                        fieldProvenance?.[key],
                      )}
                      onChange={(e) => updateField(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <label className="mt-6 block text-[10px] uppercase tracking-[0.28em] text-[#948a80]">
                Reviewer note (optional)
                <input
                  className={INPUT}
                  value={reviewerNote}
                  onChange={(e) => setReviewerNote(e.target.value)}
                />
              </label>
            </div>

            {score ? (
              <div className={`${SURFACE} p-6 md:p-8`}>
                <h3 className="font-serif text-lg text-[#1f1c19]">
                  Round-brilliant calibration score
                </h3>
                <p className="mt-1 text-xs text-[#847a70]">{score.weightingNote}</p>
                <p className="mt-2 text-sm text-[#5f5851]">{score.summary}</p>
                {score.eligible ? (
                  <p className="mt-2 font-serif text-2xl text-[#1f1c19]">
                    {score.overall}
                    <span className="ml-2 text-sm text-[#948a80]">/ 100 · {score.band}</span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-[#8a4a3a]">
                    {score.ineligibleReason}
                  </p>
                )}
                {proportionDims && proportionDims.length > 0 ? (
                  <>
                    <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-[#948a80]">
                      Proportions
                    </p>
                    <ul className="mt-2 space-y-2 text-sm text-[#5f5851]">
                      {proportionDims.map((d) => (
                        <li
                          key={d.key}
                          className="flex justify-between gap-4 border-b border-[#e4dbcf]/40 py-2"
                        >
                          <span>
                            {d.label}: {d.value ?? "—"}
                          </span>
                          <span className="shrink-0 text-[#948a80]">
                            {d.score > 0 ? `${d.score}` : "—"} · {d.note}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {finishDims && finishDims.length > 0 ? (
                  <>
                    <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-[#948a80]">
                      Reported finish (neutral scale)
                    </p>
                    <ul className="mt-2 space-y-2 text-sm text-[#5f5851]">
                      {finishDims.map((d) => (
                        <li
                          key={d.key}
                          className="flex justify-between gap-4 border-b border-[#e4dbcf]/40 py-2"
                        >
                          <span>
                            {d.label}: {String(d.value ?? "—")}
                          </span>
                          <span className="shrink-0 text-[#948a80]">
                            {d.score > 0 ? `${d.score}` : "—"} · {d.note}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                <ul className="mt-4 list-disc pl-5 text-xs text-[#847a70]">
                  {score.disclaimers.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {saveError ? (
              <p className="text-sm text-[#8a4a3a]">{saveError}</p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-sm border border-[#1f1d1a]/15 px-5 py-2.5 text-[10px] uppercase tracking-[0.28em]"
                onClick={() => setStep("upload")}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-sm border border-[#1f1d1a]/20 bg-[#1f1d1a] px-6 py-2.5 text-[10px] uppercase tracking-[0.32em] text-[#f7f3ee] disabled:opacity-40"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? "Saving…" : "Confirm & save to workbook"}
              </button>
            </div>
          </section>
        )}

        {step === "done" && (
          <section className={`mt-8 ${SURFACE} p-6 md:p-8`}>
            <h2 className="font-serif text-xl text-[#1f1c19]">Saved</h2>
            <p className="mt-3 text-sm text-[#5f5851]">
              {metadata.lab} {metadata.reportNumber} — entry{" "}
              <span className="font-mono text-xs">{savedId}</span> appended to{" "}
              <code className="text-xs">data/light-performance-calibration/workbook.json</code>.
            </p>
            <button
              type="button"
              className="mt-8 rounded-sm border border-[#1f1d1a]/20 bg-[#1f1d1a] px-6 py-2.5 text-[10px] uppercase tracking-[0.32em] text-[#f7f3ee]"
              onClick={resetWorkflow}
            >
              Ingest another report
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
