import {
  extractTextFromDocument,
  isImageMime,
  isPdfMime,
  type DocumentTextExtraction,
} from "./document-extract";
import { extractFieldsFromReportText } from "./extract-from-text";
import {
  finalizeCalibrationExtractionResult,
  type FinalizedCalibrationExtraction,
} from "./finalize-calibration-extraction";
import {
  errorMessageFromUnknown,
} from "./gcal-api-error";
import { applyGcal8xImageRegionOcrFallback, shouldRunGcalImageRegionOcr } from "./gcal-image-ocr";
import {
  applyGcalSarineProportionImageOcr,
  mergeSarine4CsGradeHintText,
  needsGcalSarineFinishImageOcr,
  needsGcalSarineImageOcr,
  needsGcalSarineProportionImageOcr,
  ocrGcalSarine4CsGradingPanel,
  shouldRunGcalSarine4CsGradingPanelOcr,
} from "./parsers/gcal/gcal-sarine-image-ocr";
import {
  hasSarineColumnListSignature,
  probeSarineFinishFromTextLayer,
} from "./parsers/gcal/gcal-sarine-4cs";
import { looksLikeGcal8xReportText } from "./parsers/gcal/gcal-layout-detector";
import {
  applyGiaFacsimileDiagramImageOcr,
  ocrGiaFacsimileFullPages,
  shouldRunGiaFacsimileDiagramImageOcr,
} from "./parsers/gia/gia-facsimile-image-ocr";
import {
  applyGiaClientPavilionDiagramOcr,
  applyGiaClientCrownDiagramOcr,
  applyGiaProportionDiagramExtraction,
} from "./parsers/gia/gia-diagram-extraction";
import { detectGiaReportStyle } from "./parsers/gia/gia-report-style";
import { looksLikeGiaReportText } from "./gia-proportions";
import {
  applyGiaOcrFieldHydrationFallback,
  extractGiaOcrProportionDiagram,
  giaProportionDiagramFieldsMissing,
  needsGiaProportionOcrSupplement,
} from "./gia-proportions";
import {
  applyIgiDiagramImageOcr,
  shouldRunIgiDiagramImageOcr,
} from "./parsers/igi/igi-diagram-image-ocr";
import { inferReportSourceFromUpload } from "./infer-report-source";
import { isIgiExtractionContext } from "./lab-parsers";
import type { ExtractionPipelineMode } from "./extraction-mode";
import { isClientExtractionMode } from "./extraction-mode";
import {
  labFamilyLabel,
  logUploadPipelineTiming,
} from "./upload-pipeline-timing";
import { clientExtractionSufficient } from "@/lib/diamond-intelligence/client-extraction-sufficient";
import { needsGiaDiagramProportionOcrWait } from "./gia-diagram-proportion-wait";
import { needsGcalSarineDiagramProportionOcrWait } from "./gcal-sarine-diagram-proportion-wait";
import type { GcalSarineProportionOcrStepDiagnostics } from "./parsers/gcal/gcal-sarine-image-ocr";
import {
  isGiaQaTraceEnabled,
  traceFieldsFromRecord,
  traceRawOcrPreview,
} from "@/lib/diamond-intelligence/gia-qa-pipeline-trace";
import { assessExtractionCompleteness } from "@/lib/diamond-intelligence/extraction-completeness";
import { assessReportCapability } from "@/lib/diamond-intelligence/report-capability";
import {
  buildExtractionDiagnosticReport,
  type ExtractionDiagnosticReport,
} from "@/lib/diamond-intelligence/extraction-diagnostics";
import {
  CalibrationTimeoutError,
  logCalibrationRuntimeCheck,
  timeoutErrorMessage,
  withTimeout,
} from "./runtime-guard";
import {
  CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS,
  CLIENT_GIA_DIAGRAM_PIPELINE_TIMEOUT_MS,
  CLIENT_GIA_DIAGRAM_REGION_OCR_TIMEOUT_MS,
  CLIENT_IMAGE_REGION_OCR_TIMEOUT_MS,
  CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS,
  DOCUMENT_EXTRACT_TIMEOUT_MS,
  EXTRACT_FILE_PIPELINE_TIMEOUT_MS,
  IMAGE_REGION_OCR_TIMEOUT_MS,
} from "./runtime-limits";
import {
  auditProductionPdfRender,
  type PdfRenderAuditRecord,
} from "./pdf-render-audit";
import {
  drainForensicSnapshots,
  setForensicCollectionEnabled,
  type ForensicSnapshot,
} from "./extraction-forensic-collector";
import type {
  ExtractionResult,
  FieldConfidence,
  ReportFieldKey,
  ReportSource,
  TextExtractionMethod,
} from "./types";

export type UploadExtractionTimings = {
  documentExtractMs: number;
  pdfFullPageOcrMs: number;
  textParseMs: number;
  imageOcrMs: number;
  finalizerMs: number;
  clientPayloadMs: number;
  totalMs: number;
  labFamily?: string;
};

export type UploadExtractionOutput = FinalizedCalibrationExtraction & {
  pipelineNotices: string[];
  ocrAttempted: boolean;
  ocrAvailable: boolean;
  pdfTextLayerLength: number;
  gcalImageOnlyPdf: boolean;
  extractedCharCount: number;
  timings: UploadExtractionTimings;
  parserPathUsed?: string;
  timedOut?: boolean;
  pipelineError?: string;
  /** Client route returned fields gathered before timeout. */
  clientPartial?: boolean;
  /** GIA diagram OCR budget exhausted — proportions not recovered; do not imply absent. */
  diagramOcrTimedOut?: boolean;
  /** Developer-only field-by-field extraction diagnostics (when requested). */
  diagnostics?: ExtractionDiagnosticReport;
  /** Production PDF render audit — infrastructure only, no scoring impact. */
  renderAudit?: PdfRenderAuditRecord;
  /** GCAL Sarine diagram OCR step trace — gated for DI_INTERPRET_DIAGNOSTICS. */
  gcalSarineOcrDiagnostics?: GcalSarineProportionOcrStepDiagnostics;
  gcalSarineDiagramProportionWait?: boolean;
  gcalSarineDiagramOcrFailure?: string;
  /** Developer-only OCR/assignment traces (when collectForensics). */
  forensicSnapshots?: ForensicSnapshot[];
};

export type RunUploadExtractionInput = {
  bytes?: Buffer;
  mime?: string;
  pastedText?: string;
  lab?: string;
  reportNumber?: string;
  reportSource?: ReportSource;
  pipelineTimeoutMs?: number;
  /** Override region OCR budget (client GIA diagram wait). */
  regionOcrTimeoutMs?: number;
  /** `client` = diamond-intelligence interpret; default preserves calibration/admin behavior. */
  mode?: ExtractionPipelineMode;
  /** When set (e.g. extract-file route), skip a second document-extract pass. */
  preExtractedDocument?: DocumentTextExtraction;
  /** Notices collected before pipeline (upload save, document-extract, etc.). */
  initialPipelineNotices?: string[];
  /**
   * Developer-only: when true, attach a field-by-field `diagnostics` report to
   * the output. Default off — does not change parser/scoring/public behavior.
   */
  collectDiagnostics?: boolean;
  /**
   * Attach production PDF render audit (renderer, timing, dimensions, OCR readiness).
   * Default: on in calibration mode, off in client mode.
   */
  collectRenderAudit?: boolean;
  /**
   * Developer-only: capture OCR/assignment forensic snapshots from parser paths.
   */
  collectForensics?: boolean;
};

function pickGradeHintText(current: string, candidate: string): string {
  const next = candidate.trim();
  if (!next) return current;
  if (next.length > current.length) return next.slice(0, 16000);
  return current;
}

function syncParsedGradeHintText(
  parsed: ExtractionResult,
  gradeHintText: string,
): void {
  parsed.reportGradeHintText = gradeHintText.slice(0, 16000);
}

/** Display-only — detect when 4Cs text is likely absent from the PDF text layer. */
function gradeHintTextLikelyIncomplete(text: string): boolean {
  const hasClarityGrade =
    /\bclarity\s+grade\b[\s\S]{0,48}\b(?:FL|IF|VVS\s*1|VVS\s*2|VS\s*1|VS\s*2|SI\s*1|SI\s*2|I\s*1|I\s*2|I\s*3)\b/i.test(
      text,
    );
  const hasClarityShort =
    /\bclarity\b[\s\S]{0,32}\b(?:FL|IF|VVS\s*1|VVS\s*2|VS\s*1|VS\s*2|SI\s*1|SI\s*2|I\s*1|I\s*2|I\s*3|VVS1|VVS2|VS1|VS2|SI1|SI2|I1|I2|I3)\b/i.test(
      text,
    );
  const hasColorGrade =
    /\bcolou?r\s+grade\b[\s\S]{0,48}(?:[D-Z](?:\s+to\s+[A-Z](?:\s+range)?)?|fancy)/i.test(
      text,
    );
  const hasColorShort =
    /\bcolou?r\b[\s\S]{0,24}\b[D-Z]\b/i.test(text) ||
    /\bGCAL\s+LG?\d{6,12}\s+RB\s+[\d.]+\s+[D-Z]\s+(?:FL|IF|VVS|VS|SI|I)/i.test(
      text,
    );
  const hasClarity = hasClarityGrade || hasClarityShort;
  const hasColor = hasColorGrade || hasColorShort;
  return !hasClarity || !hasColor;
}

async function runImageOcrAugmentation(input: {
  documentBytes: Buffer;
  imageUpload?: boolean;
  combined: string;
  parsed: ExtractionResult;
  effectiveMethod: TextExtractionMethod;
  reportNumberHint: string;
  gcalImageOnlyPdf?: boolean;
  clientMode?: boolean;
  regionOcrTimeoutMs?: number;
  onGradeHintTextUpdate?: (text: string) => void;
}): Promise<{
  imageOcrMs: number;
  ocrCompleted: boolean;
  gradeHintText: string;
  diagramOcrNotices?: string[];
  gcalSarineDiagramOcrFailure?: string;
  gcalSarineOcrDiagnostics?: GcalSarineProportionOcrStepDiagnostics;
}> {
  const {
    documentBytes,
    imageUpload = false,
    combined,
    parsed,
    effectiveMethod,
    reportNumberHint,
    gcalImageOnlyPdf,
  } = input;
  const started = Date.now();
  let ocrCompleted = false;
  const diagramOcrNotices: string[] = [];
  let gcalSarineDiagramOcrFailure: string | undefined;
  let gcalSarineOcrDiagnostics: GcalSarineProportionOcrStepDiagnostics | undefined;
  let gradeHintText = combined.slice(0, 16000);
  const publishGradeHintText = (candidate: string) => {
    gradeHintText = pickGradeHintText(gradeHintText, candidate);
    syncParsedGradeHintText(parsed, gradeHintText);
    input.onGradeHintTextUpdate?.(gradeHintText);
  };
  publishGradeHintText(gradeHintText);
  const clientMode = input.clientMode ?? false;
  const regionOcrTimeoutMs =
    input.regionOcrTimeoutMs ??
    (clientMode
      ? CLIENT_IMAGE_REGION_OCR_TIMEOUT_MS
      : IMAGE_REGION_OCR_TIMEOUT_MS);

  if (
    parsed.parserType === "gcal-sarine-4cs" &&
    shouldRunGcalSarine4CsGradingPanelOcr({
      parserType: parsed.parserType,
      combinedText: combined,
      gradeHintText,
      imageUpload,
    })
  ) {
    try {
      const panelOcr = await withTimeout(
        ocrGcalSarine4CsGradingPanel(documentBytes, {
          imageUpload,
          reportNumber: reportNumberHint || undefined,
        }),
        Math.min(regionOcrTimeoutMs, 12_000),
        "sarine-4cs-grading-panel-ocr",
      );
      if (panelOcr.text.trim()) {
        publishGradeHintText(
          mergeSarine4CsGradeHintText(gradeHintText, panelOcr.text),
        );
        ocrCompleted = true;
      }
    } catch {
      // Best-effort — full-page OCR remains fallback.
    }
  }

  const isIgi = isIgiExtractionContext({
    lab: parsed.metadata.lab,
    parserType: parsed.parserType,
    combinedText: combined,
  });
  if (
    looksLikeGiaReportText(combined) &&
    parsed.metadata.lab !== "GIA" &&
    !parsed.parserType?.startsWith("gcal") &&
    !isIgi
  ) {
    parsed.metadata.lab = "GIA";
  }
  const labFamily = labFamilyLabel(parsed.metadata.lab, parsed.parserType);

  // Client mode short-circuits ONLY when proportion-capable (full read achievable).
  // Usefulness/partial classification is owned exclusively by the interpret route.
  const clientSatisfied = () =>
    clientMode &&
    clientExtractionSufficient({
      fields: parsed.fields,
      confidence: parsed.confidence,
    });

  const sarineColumnListSignature = hasSarineColumnListSignature(combined);
  const runSarine =
    (sarineColumnListSignature &&
      (parsed.parserType === "gcal-sarine-4cs" ||
        needsGcalSarineImageOcr(parsed.fields))) ||
    (imageUpload &&
      parsed.parserType === "gcal-sarine-4cs" &&
      needsGcalSarineImageOcr(parsed.fields));

  const diagramOcrCoreKeys: ReportFieldKey[] = [
    "tablePercent",
    "depthPercent",
    "crownAngle",
    "pavilionAngle",
  ];

  const capConfidence = (
    key: ReportFieldKey,
    level: FieldConfidence,
  ): FieldConfidence => {
    if (effectiveMethod !== "ocr") return level;
    if (diagramOcrCoreKeys.includes(key) && level === "medium") {
      return "medium";
    }
    if (level === "high") return "medium";
    if (level === "medium") return "low";
    return level;
  };

  const setField = (
    key: ReportFieldKey,
    value: string,
    level: FieldConfidence,
  ) => {
    if (!value.trim() || parsed.fields[key].trim()) return;
    parsed.fields[key] = value.trim();
    parsed.confidence[key] = capConfidence(key, level);
  };

  const ocrResult = () => ({
    imageOcrMs: Date.now() - started,
    ocrCompleted,
    gradeHintText,
    diagramOcrNotices:
      diagramOcrNotices.length > 0 ? diagramOcrNotices : undefined,
    gcalSarineDiagramOcrFailure,
    gcalSarineOcrDiagnostics,
  });

  if (runSarine) {
    const proportionGatePassed = needsGcalSarineProportionImageOcr(parsed.fields);
    const finishGatePassed = needsGcalSarineFinishImageOcr(parsed.fields);
    if (
      process.env.NODE_ENV === "development" &&
      !proportionGatePassed &&
      !finishGatePassed
    ) {
      console.log("[upload-pipeline] sarine-ocr:skipped-gates", {
        parser: parsed.parserType,
        tablePercent: parsed.fields.tablePercent.trim() || "(empty)",
        depthPercent: parsed.fields.depthPercent.trim() || "(empty)",
        crownAngle: parsed.fields.crownAngle.trim() || "(empty)",
        pavilionAngle: parsed.fields.pavilionAngle.trim() || "(empty)",
      });
    }
    if (proportionGatePassed || finishGatePassed) {
      const gcalInternal = parsed.gcalInternal ?? {};
      try {
        const sarineOcr = await withTimeout(
          applyGcalSarineProportionImageOcr(
            documentBytes,
            combined,
            parsed.fields,
            gcalInternal,
            setField,
            {
              reportNumber: reportNumberHint || undefined,
              parserPathUsed: parsed.parserType,
              imageUpload,
            },
          ),
          regionOcrTimeoutMs,
          "sarine-image-ocr",
        );
        if (Object.keys(gcalInternal).length > 0) {
          parsed.gcalInternal = gcalInternal;
        }
        ocrCompleted = true;
        if (sarineOcr.diagramOcrFailure) {
          gcalSarineDiagramOcrFailure = sarineOcr.diagramOcrFailure;
        }
        gcalSarineOcrDiagnostics = sarineOcr.stepDiagnostics;
        if (!sarineOcr.coreProportionsRecovered) {
          const detail = sarineOcr.diagramOcrFailure
            ? ` (${sarineOcr.diagramOcrFailure})`
            : "";
          diagramOcrNotices.push(
            `GCAL Sarine diagram OCR: core proportions (table, depth, crown angle, pavilion angle) were not recovered from the diagram image${detail}.`,
          );
        }
      } catch (ocrErr) {
        const ocrErrMsg = errorMessageFromUnknown(ocrErr);
        gcalSarineDiagramOcrFailure = ocrErrMsg.toLowerCase().includes("timeout")
          ? "diagram-ocr-timeout"
          : "diagram-ocr-error";
        diagramOcrNotices.push(
          `GCAL Sarine diagram OCR failed: ${ocrErrMsg} — proportion fields require diagram image read.`,
        );
      }
      probeSarineFinishFromTextLayer(combined);
      logUploadPipelineTiming({
        phase: "ocr-region-crops",
        durationMs: Date.now() - started,
        labFamily: "GCAL-Sarine",
        parserPath: parsed.parserType,
      });
      if (clientSatisfied()) {
        return ocrResult();
      }
    }
  } else if (
    shouldRunGcalImageRegionOcr(parsed.fields, {
      parserType: parsed.parserType,
      lab: parsed.metadata.lab,
      gcalImageOnlyPdf,
      labHint: parsed.metadata.lab,
      combinedText: combined,
    }) ||
    (parsed.parserType === "gcal-sarine-4cs" &&
      !sarineColumnListSignature &&
      looksLikeGcal8xReportText(combined))
  ) {
    const gcalInternal = parsed.gcalInternal ?? {};
    const gcal8xRegionOcr = await withTimeout(
      applyGcal8xImageRegionOcrFallback(
        documentBytes,
        parsed.fields,
        gcalInternal,
        setField,
        {
          reportNumber: reportNumberHint || undefined,
          combinedText: combined,
          lazySecondPage: clientMode,
          clientOnlyFirstPage: clientMode,
          imageUpload,
        },
      ),
      regionOcrTimeoutMs,
      "gcal-8x-image-ocr",
    );
    const regionHintText = [
      gcal8xRegionOcr.finishRegionText,
      gcal8xRegionOcr.proportionRegionText,
    ]
      .filter(Boolean)
      .join("\n\n");
    if (regionHintText.trim()) {
      publishGradeHintText(
        [regionHintText, gradeHintText].filter(Boolean).join("\n\n"),
      );
    }
    if (Object.keys(gcalInternal).length > 0) {
      parsed.gcalInternal = gcalInternal;
    }
    ocrCompleted = true;
    logUploadPipelineTiming({
      phase: "ocr-region-crops",
      durationMs: Date.now() - started,
      labFamily: "GCAL-8X",
      parserPath: parsed.parserType,
    });
    if (clientSatisfied()) {
      return ocrResult();
    }
  }

  if (clientMode && !isIgi) {
    const isGia =
      parsed.metadata.lab === "GIA" ||
      Boolean(parsed.parserType?.startsWith("gia")) ||
      looksLikeGiaReportText(combined);
    if (
      isGia &&
      giaProportionDiagramFieldsMissing(parsed.fields)
    ) {
      const giaInternal = parsed.giaInternal ?? {};
      let giaCombined = combined;
      publishGradeHintText(giaCombined);
      const giaStyleDetection = detectGiaReportStyle(combined);
      const lgdrDossier =
        giaStyleDetection.layout === "lgdr-dossier" ||
        /laboratory[-\s]*grown\s+diamond\s+report[\s\S]{0,160}dossier/i.test(
          combined,
        ) ||
        /\bLGDR\b/i.test(combined);
      const coloredSimplified =
        giaStyleDetection.style === "GIA_NATURAL_COLORED_SIMPLIFIED";
      const clientDiagramFirst =
        (lgdrDossier || coloredSimplified) &&
        giaProportionDiagramFieldsMissing(parsed.fields);
      if (clientDiagramFirst) {
        try {
          await withTimeout(
            applyGiaProportionDiagramExtraction(
              documentBytes,
              giaCombined,
              parsed.fields,
              giaInternal,
              setField,
              {
                reportNumber: reportNumberHint || undefined,
                imageUpload,
              },
            ),
            Math.max(regionOcrTimeoutMs - (Date.now() - started), 5_000),
            "client-gia-diagram-band-ocr",
          );
        } catch {
          // Continue with scatter / facsimile fallback.
        }
      }
      if (
        !imageUpload &&
        needsGiaProportionOcrSupplement(combined) &&
        !clientDiagramFirst
      ) {
        try {
          const fullOcr = await withTimeout(
            ocrGiaFacsimileFullPages(documentBytes),
            Math.max(regionOcrTimeoutMs, 12_000),
            "client-gia-full-page-ocr",
          );
          if (fullOcr.ok && fullOcr.text.trim()) {
            giaCombined = [fullOcr.text, combined].filter(Boolean).join("\n\n");
            publishGradeHintText(giaCombined);
          }
        } catch {
          // Budget exhausted — still attempt scatter parse on PDF text layer.
        }
      }
      extractGiaOcrProportionDiagram(giaCombined, parsed.fields, setField, giaInternal);
      applyGiaOcrFieldHydrationFallback(giaCombined, parsed.fields, setField);
      if (
        imageUpload &&
        giaProportionDiagramFieldsMissing(parsed.fields) &&
        !clientDiagramFirst
      ) {
        try {
          await withTimeout(
            applyGiaProportionDiagramExtraction(
              documentBytes,
              giaCombined,
              parsed.fields,
              giaInternal,
              setField,
              {
                reportNumber: reportNumberHint || undefined,
                imageUpload: true,
              },
            ),
            Math.max(regionOcrTimeoutMs - (Date.now() - started), 4_000),
            "client-gia-image-diagram-band-ocr",
          );
        } catch {
          // Best-effort band OCR on uploaded image.
        }
      }
      const giaDiagramGate = shouldRunGiaFacsimileDiagramImageOcr(
        parsed.fields,
        giaCombined,
        {
          parserType: parsed.parserType,
          lab: parsed.metadata.lab,
        },
      );
      if (
        giaDiagramGate.run &&
        !imageUpload &&
        giaProportionDiagramFieldsMissing(parsed.fields)
      ) {
        const elapsedMs = Date.now() - started;
        const remainingBudgetMs = Math.max(regionOcrTimeoutMs - elapsedMs, 4_000);
        try {
          // Client facsimile order + budget:
          // 1) Crown band first (~3s) — facsimile multi-crop can consume the full 18s
          //    region budget and previously left no time for crown recovery (6532930018).
          // 2) Facsimile multi-crop with remaining budget (reserve 3.5s for pavilion band).
          // 3) Pavilion band if still missing.
          if (!parsed.fields.crownAngle.trim()) {
            try {
              await withTimeout(
                applyGiaClientCrownDiagramOcr(
                  documentBytes,
                  parsed.fields,
                  setField,
                ),
                3_500,
                "client-gia-crown-band-ocr",
              );
            } catch {
              // Crown band budget exhausted.
            }
          }

          const afterCrownMs = Date.now() - started;
          const facsimileBudgetMs = Math.max(
            4_000,
            Math.min(
              regionOcrTimeoutMs - afterCrownMs,
              regionOcrTimeoutMs - afterCrownMs - 3_500,
            ),
          );
          try {
            const facsimileOcr = await withTimeout(
              applyGiaFacsimileDiagramImageOcr(
                documentBytes,
                giaCombined,
                parsed.fields,
                giaInternal,
                setField,
                {
                  reportNumber: reportNumberHint || undefined,
                  parserPathUsed: parsed.parserType,
                },
              ),
              facsimileBudgetMs,
              "client-gia-facsimile-diagram-ocr",
            );
            if (facsimileOcr.gradeHintSupplement) {
              publishGradeHintText(facsimileOcr.gradeHintSupplement);
            }
          } catch {
            // Facsimile budget exhausted — still attempt targeted band fallbacks.
          }

          let remainingMs = regionOcrTimeoutMs - (Date.now() - started);
          if (!parsed.fields.crownAngle.trim() && remainingMs >= 2_000) {
            try {
              await withTimeout(
                applyGiaClientCrownDiagramOcr(
                  documentBytes,
                  parsed.fields,
                  setField,
                ),
                Math.min(remainingMs, 3_500),
                "client-gia-crown-band-ocr-late",
              );
            } catch {
              // Crown band budget exhausted.
            }
            remainingMs = regionOcrTimeoutMs - (Date.now() - started);
          }

          if (!parsed.fields.pavilionAngle.trim() && remainingMs >= 2_000) {
            try {
              await withTimeout(
                applyGiaClientPavilionDiagramOcr(
                  documentBytes,
                  parsed.fields,
                  setField,
                ),
                Math.min(remainingMs, 3_500),
                "client-gia-pavilion-band-ocr",
              );
            } catch {
              // Pavilion band budget exhausted.
            }
          }
        } catch {
          // Client OCR budget exhausted — keep scatter-only partial fields.
        }
      }
      if (Object.keys(giaInternal).length > 0) {
        parsed.giaInternal = giaInternal;
      }
      ocrCompleted = true;
      logUploadPipelineTiming({
        phase: "ocr-region-crops",
        durationMs: Date.now() - started,
        labFamily,
        parserPath: parsed.parserType,
        detail: clientSatisfied()
          ? "client-gia-diagram-complete"
          : "client-gia-diagram-partial",
      });
      if (clientSatisfied()) {
        return ocrResult();
      }
    }

    // Client budget: skip GIA facsimile multi-crop / IGI diagram OCR after targeted diagram pass.
    logUploadPipelineTiming({
      phase: "ocr-region-crops",
      durationMs: Date.now() - started,
      labFamily,
      parserPath: parsed.parserType,
      detail: clientSatisfied()
        ? "client-sufficient"
        : "skipped-gia-igi-client-budget",
    });
    return ocrResult();
  }

  const giaGate = shouldRunGiaFacsimileDiagramImageOcr(parsed.fields, combined, {
    parserType: parsed.parserType,
    lab: parsed.metadata.lab,
  });
  if (giaGate.run && !imageUpload && !isIgi) {
    const giaInternal = parsed.giaInternal ?? {};
    const facsimileOcr = await withTimeout(
      applyGiaFacsimileDiagramImageOcr(
        documentBytes,
        combined,
        parsed.fields,
        giaInternal,
        setField,
        {
          reportNumber: reportNumberHint || undefined,
          parserPathUsed: parsed.parserType,
        },
      ),
      IMAGE_REGION_OCR_TIMEOUT_MS,
      "gia-facsimile-diagram-ocr",
    );
    if (facsimileOcr.gradeHintSupplement) {
      publishGradeHintText(facsimileOcr.gradeHintSupplement);
    }
    if (Object.keys(giaInternal).length > 0) {
      parsed.giaInternal = giaInternal;
    }
    ocrCompleted = true;
  }

  const igiGate = shouldRunIgiDiagramImageOcr(parsed.fields, combined, {
    parserType: parsed.parserType,
    lab: parsed.metadata.lab,
  });
  if (igiGate.run && !imageUpload) {
    const igiInternal = parsed.igiInternal ?? {};
    await withTimeout(
      applyIgiDiagramImageOcr(
        documentBytes,
        combined,
        parsed.fields,
        igiInternal,
        setField,
        {
          reportNumber: reportNumberHint || undefined,
          parserPathUsed: parsed.parserType,
          onMetadata: (meta) => {
            parsed.extractionMeta = {
              ...parsed.extractionMeta,
              usedImageOCR: true,
              pdfTextLayerLength: parsed.extractionMeta?.pdfTextLayerLength ?? 0,
              fallbackStage:
                parsed.extractionMeta?.fallbackStage ?? "image-region-ocr",
              igiDiagramLowerGirdleCandidate:
                typeof meta.igiDiagramLowerGirdleCandidate === "string"
                  ? meta.igiDiagramLowerGirdleCandidate
                  : parsed.extractionMeta?.igiDiagramLowerGirdleCandidate,
            };
          },
        },
      ),
      IMAGE_REGION_OCR_TIMEOUT_MS,
      "igi-diagram-ocr",
    );
    if (Object.keys(igiInternal).length > 0) {
      parsed.igiInternal = igiInternal;
    }
    ocrCompleted = true;
  }

  return ocrResult();
}

/** Same extraction path as `/api/calibration-library/extract-file` (bounded). */
export async function runCalibrationUploadExtraction(
  input: RunUploadExtractionInput,
): Promise<UploadExtractionOutput> {
  const pipelineStarted = Date.now();
  const t0 = pipelineStarted;
  const pipelineNotices: string[] = [];
  const timings: UploadExtractionTimings = {
    documentExtractMs: 0,
    pdfFullPageOcrMs: 0,
    textParseMs: 0,
    imageOcrMs: 0,
    finalizerMs: 0,
    clientPayloadMs: 0,
    totalMs: 0,
  };

  const clientMode = isClientExtractionMode(input.mode);
  const timeoutMs =
    input.pipelineTimeoutMs ??
    (clientMode
      ? CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS
      : EXTRACT_FILE_PIPELINE_TIMEOUT_MS);
  const docExtractTimeoutMs = clientMode
    ? CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS
    : DOCUMENT_EXTRACT_TIMEOUT_MS;

  const snapshot: {
    parsed: ExtractionResult | null;
    combined: string;
    gradeHintText: string;
    ocrAttempted: boolean;
    ocrAvailable: boolean;
    pdfTextLayerLength: number;
    gcalImageOnlyPdf: boolean;
    giaDiagramProportionWait?: boolean;
    gcalSarineDiagramProportionWait?: boolean;
    gcalSarineDiagramOcrFailure?: string;
    gcalSarineOcrDiagnostics?: GcalSarineProportionOcrStepDiagnostics;
  } = {
    parsed: null,
    combined: "",
    gradeHintText: "",
    ocrAttempted: false,
    ocrAvailable: false,
    pdfTextLayerLength: 0,
    gcalImageOnlyPdf: false,
  };

  // Developer-only diagnostics. Off by default → no public behavior change.
  const buildDiagnostics = (
    finalized: FinalizedCalibrationExtraction,
    combined: string,
    usedImageOCR: boolean,
  ): ExtractionDiagnosticReport | undefined => {
    if (!input.collectDiagnostics && !input.collectForensics) return undefined;
    return buildExtractionDiagnosticReport({
      extraction: finalized,
      rawText: combined,
      normalizedFields: finalized.fieldsNormalized,
      usedImageOCR,
      reportNumber: input.reportNumber,
      lab: input.lab,
      pdfTextLayerLength: snapshot.pdfTextLayerLength,
      gcalImageOnlyPdf: snapshot.gcalImageOnlyPdf,
    });
  };

  const assembleOutput = (
    finalized: FinalizedCalibrationExtraction,
    extra: {
      ocrAttempted: boolean;
      ocrAvailable: boolean;
      combined: string;
      clientPartial?: boolean;
      timedOut?: boolean;
      diagramOcrTimedOut?: boolean;
      pipelineError?: string;
      renderAudit?: PdfRenderAuditRecord;
      forensicSnapshots?: ForensicSnapshot[];
      gcalSarineDiagramProportionWait?: boolean;
      gcalSarineOcrDiagnostics?: GcalSarineProportionOcrStepDiagnostics;
      gcalSarineDiagramOcrFailure?: string;
    },
  ): UploadExtractionOutput => {
    timings.totalMs = Date.now() - pipelineStarted;
    return {
      ...finalized,
      pipelineNotices,
      ocrAttempted: extra.ocrAttempted,
      ocrAvailable: extra.ocrAvailable,
      pdfTextLayerLength: snapshot.pdfTextLayerLength,
      gcalImageOnlyPdf: snapshot.gcalImageOnlyPdf,
      extractedCharCount: extra.combined.length,
      timings,
      parserPathUsed: finalized.parserType,
      calibrationEligible: finalized.calibrationEligible,
      excludedFromCalibrationStats: finalized.excludedFromCalibrationStats,
      corpusReviewFlags: finalized.corpusReviewFlags,
      clientPartial: extra.clientPartial,
      timedOut: extra.timedOut,
      diagramOcrTimedOut: extra.diagramOcrTimedOut,
      pipelineError: extra.pipelineError,
      diagnostics: buildDiagnostics(finalized, extra.combined, extra.ocrAttempted),
      renderAudit: extra.renderAudit,
      forensicSnapshots: extra.forensicSnapshots,
      gcalSarineDiagramProportionWait: extra.gcalSarineDiagramProportionWait,
      gcalSarineOcrDiagnostics: extra.gcalSarineOcrDiagnostics,
      gcalSarineDiagramOcrFailure: extra.gcalSarineDiagramOcrFailure,
    };
  };

  try {
    setForensicCollectionEnabled(Boolean(input.collectForensics));

    const executeUploadPipeline = async (): Promise<UploadExtractionOutput> => {
        if (input.initialPipelineNotices?.length) {
          pipelineNotices.push(...input.initialPipelineNotices);
        }

        let ocrAvailable = false;
        const pastedText = input.pastedText?.trim() ?? "";
        let docText = "";
        let textMethod: TextExtractionMethod = pastedText ? "manual" : "none";
        let ocrAttempted = false;
        let uploadPdfBytes: Buffer | undefined;
        let gcalImageOnlyPdf = false;
        let pdfTextLayerLength = 0;
        let renderAudit: PdfRenderAuditRecord | undefined;
        const shouldCollectRenderAudit = input.collectRenderAudit ?? !clientMode;

        if (input.bytes && input.bytes.length > 0 && input.mime) {
          if (isPdfMime(input.mime)) {
            uploadPdfBytes = input.bytes;
          }

          if (input.preExtractedDocument) {
            const doc = input.preExtractedDocument;
            timings.documentExtractMs = 0;
            console.log("[upload-pipeline] document-extract:reused", {
              ms: Date.now() - t0,
              method: doc.method,
              textLen: doc.text.length,
            });
            docText = doc.text;
            textMethod = doc.method;
            ocrAttempted = doc.ocrAttempted;
            ocrAvailable = doc.ocrAvailable;
            pdfTextLayerLength = doc.pdfTextLayerLength;
            gcalImageOnlyPdf = doc.gcalImageOnlyPdf;
            snapshot.ocrAvailable = doc.ocrAvailable;
            if (!input.initialPipelineNotices?.length) {
              pipelineNotices.push(...doc.notices);
            }
          } else {
            const docStarted = Date.now();
            console.log("[upload-pipeline] document-extract:start", {
              ms: Date.now() - t0,
            });
            const doc = await withTimeout(
              extractTextFromDocument(input.bytes, input.mime, {
                mode: input.mode,
              }),
              docExtractTimeoutMs,
              "document-extract",
            );
            timings.documentExtractMs = Date.now() - docStarted;
            if (
              clientMode &&
              doc.notices.some((n) => n.includes("full-page OCR skipped"))
            ) {
              timings.pdfFullPageOcrMs = 0;
            }
            console.log("[upload-pipeline] document-extract:end", {
              ms: Date.now() - t0,
              method: doc.method,
              textLen: doc.text.length,
            });
            docText = doc.text;
            textMethod = doc.method;
            ocrAttempted = doc.ocrAttempted;
            ocrAvailable = doc.ocrAvailable;
            pdfTextLayerLength = doc.pdfTextLayerLength;
            gcalImageOnlyPdf = doc.gcalImageOnlyPdf;
            snapshot.ocrAvailable = doc.ocrAvailable;
            pipelineNotices.push(...doc.notices);
          }
        }

        if (uploadPdfBytes && shouldCollectRenderAudit) {
          try {
            renderAudit = await auditProductionPdfRender(uploadPdfBytes, {
              scale: 2,
              probeOcr: Boolean(input.collectDiagnostics),
            });
          } catch (auditErr) {
            pipelineNotices.push(
              `PDF render audit failed: ${errorMessageFromUnknown(auditErr)}`,
            );
          }
        }

        const combined = [pastedText, docText].filter(Boolean).join("\n\n").trim();
        const effectiveMethod: TextExtractionMethod =
          pastedText && docText
            ? textMethod
            : pastedText
              ? "manual"
              : textMethod;

        const reportSource =
          input.reportSource ??
          inferReportSourceFromUpload(input.mime, Boolean(pastedText));

        const parseStarted = Date.now();
        console.log("[upload-pipeline] text-parse:start", { ms: Date.now() - t0 });
        const parsed = extractFieldsFromReportText(combined, {
          lab: input.lab,
          reportSource,
          textMethod: effectiveMethod,
          reportNumber: input.reportNumber,
          pdfTextLayerLength,
          gcalImageOnlyPdf,
          usedImageOCR: ocrAttempted && Boolean(docText),
        });
        timings.textParseMs = Date.now() - parseStarted;
        timings.labFamily = labFamilyLabel(parsed.metadata.lab, parsed.parserType);
        logUploadPipelineTiming({
          phase: "text-parse",
          durationMs: timings.textParseMs,
          labFamily: timings.labFamily,
          parserPath: parsed.parserType,
        });
        console.log("[upload-pipeline] text-parse:end", {
          ms: Date.now() - t0,
          parser: parsed.parserType,
        });

        const reportNumberHint =
          input.reportNumber?.trim() ||
          parsed.metadata.reportNumber.trim() ||
          "";

        if (isGiaQaTraceEnabled(reportNumberHint)) {
          traceRawOcrPreview(reportNumberHint, combined, {
            textMethod: effectiveMethod,
            parserType: parsed.parserType,
          });
          traceFieldsFromRecord("textParse", reportNumberHint, parsed.fields, {
            parserType: parsed.parserType,
            clientExtractionSufficient: clientExtractionSufficient({
              fields: parsed.fields,
              confidence: parsed.confidence,
            }),
            supportsLevel: assessReportCapability({ fields: parsed.fields })
              .supportsLevel,
          });
        }

        snapshot.parsed = parsed;
        snapshot.combined = combined;
        snapshot.gradeHintText = combined.slice(0, 16000);
        parsed.rawTextSnippet = combined.slice(0, 1200);
        syncParsedGradeHintText(parsed, snapshot.gradeHintText);
        snapshot.ocrAttempted = ocrAttempted;
        snapshot.pdfTextLayerLength = pdfTextLayerLength;
        snapshot.gcalImageOnlyPdf = gcalImageOnlyPdf;

        let gradeHintText = snapshot.gradeHintText;

        const publishSnapshotGradeHintText = (text: string) => {
          gradeHintText = pickGradeHintText(gradeHintText, text);
          snapshot.gradeHintText = gradeHintText;
          if (snapshot.parsed) {
            syncParsedGradeHintText(snapshot.parsed, gradeHintText);
          }
        };

        let giaDiagramProportionWait = false;
        let gcalSarineDiagramProportionWait = false;
        let clientRegionOcrTimeoutMs =
          input.regionOcrTimeoutMs ?? CLIENT_IMAGE_REGION_OCR_TIMEOUT_MS;
        if (clientMode && uploadPdfBytes) {
          giaDiagramProportionWait = needsGiaDiagramProportionOcrWait({
            fields: parsed.fields,
            combinedText: combined,
            parserType: parsed.parserType,
            lab: parsed.metadata.lab,
            gradeHintText,
          });
          gcalSarineDiagramProportionWait =
            needsGcalSarineDiagramProportionOcrWait({
              fields: parsed.fields,
              combinedText: combined,
              parserType: parsed.parserType,
              lab: parsed.metadata.lab,
              gradeHintText,
            });
          snapshot.giaDiagramProportionWait = giaDiagramProportionWait;
          snapshot.gcalSarineDiagramProportionWait =
            gcalSarineDiagramProportionWait;
          if (giaDiagramProportionWait || gcalSarineDiagramProportionWait) {
            clientRegionOcrTimeoutMs =
              input.regionOcrTimeoutMs ??
              CLIENT_GIA_DIAGRAM_REGION_OCR_TIMEOUT_MS;
          }
        }

        const runOcrFinalizeAndReturn = async (): Promise<UploadExtractionOutput> => {
        let ocrSkippedForSufficientText = false;

        if (
          clientMode &&
          clientExtractionSufficient({
            fields: parsed.fields,
            confidence: parsed.confidence,
          })
        ) {
          // Text layer alone already supports a full read — skip OCR entirely.
          ocrSkippedForSufficientText = true;
          logUploadPipelineTiming({
            phase: "ocr-region-crops",
            durationMs: 0,
            labFamily: timings.labFamily,
            parserPath: parsed.parserType,
            detail: "skipped-client-text-parse-sufficient",
          });
        } else if (
          (uploadPdfBytes ||
            (clientMode && input.bytes && isImageMime(input.mime ?? ""))) &&
          input.bytes
        ) {
          const documentBytes = input.bytes;
          const imageUpload = !uploadPdfBytes;
          try {
            if (process.env.NODE_ENV === "development") {
              console.log("[upload-pipeline] image-ocr:start", { ms: Date.now() - t0 });
            }
            const ocr = await runImageOcrAugmentation({
              documentBytes,
              imageUpload,
              combined,
              parsed,
              effectiveMethod,
              reportNumberHint,
              gcalImageOnlyPdf,
              clientMode,
              regionOcrTimeoutMs: clientRegionOcrTimeoutMs,
              onGradeHintTextUpdate: publishSnapshotGradeHintText,
            });
            timings.imageOcrMs = ocr.imageOcrMs;
            if (ocr.ocrCompleted) ocrAttempted = true;
            publishSnapshotGradeHintText(ocr.gradeHintText);
            if (ocr.diagramOcrNotices?.length) {
              pipelineNotices.push(...ocr.diagramOcrNotices);
              parsed.warnings.push(...ocr.diagramOcrNotices);
            }
            if (ocr.gcalSarineDiagramOcrFailure) {
              snapshot.gcalSarineDiagramOcrFailure =
                ocr.gcalSarineDiagramOcrFailure;
            }
            if (ocr.gcalSarineOcrDiagnostics) {
              snapshot.gcalSarineOcrDiagnostics = ocr.gcalSarineOcrDiagnostics;
            }
            if (process.env.NODE_ENV === "development") {
              console.log("[upload-pipeline] image-ocr:end", {
                ms: Date.now() - t0,
                imageOcrMs: timings.imageOcrMs,
                ocrCompleted: ocr.ocrCompleted,
                gradeHintTextLen: gradeHintText.length,
              });
            }
          } catch (ocrErr) {
            const ocrErrMsg = errorMessageFromUnknown(ocrErr);
            if (process.env.NODE_ENV === "development") {
              console.log("[upload-pipeline] image-ocr:error", {
                ms: Date.now() - t0,
                parser: parsed.parserType,
                message: ocrErrMsg,
              });
            }
            pipelineNotices.push(`Image region OCR failed: ${ocrErrMsg}`);
          }
          snapshot.ocrAttempted = ocrAttempted;
        }

        if (
          clientMode &&
          ocrSkippedForSufficientText &&
          uploadPdfBytes &&
          gradeHintTextLikelyIncomplete(gradeHintText) &&
          (parsed.metadata.lab === "GIA" ||
            Boolean(parsed.parserType?.startsWith("gia")))
        ) {
          try {
            const fullOcr = await withTimeout(
              ocrGiaFacsimileFullPages(uploadPdfBytes),
              12_000,
              "client-gia-grade-hint-ocr",
            );
            if (fullOcr.ok && fullOcr.text.trim()) {
              publishSnapshotGradeHintText(
                [fullOcr.text, combined].filter(Boolean).join("\n\n"),
              );
            }
          } catch {
            // Grade-hint OCR is best-effort — proportions already sufficient.
          }
        }

        parsed.textMethod = effectiveMethod;
        parsed.rawTextSnippet = combined.slice(0, 1200);
        syncParsedGradeHintText(parsed, gradeHintText);
        snapshot.parsed = parsed;
        snapshot.gradeHintText = gradeHintText;

        if (isGiaQaTraceEnabled(reportNumberHint)) {
          traceFieldsFromRecord("afterRegionOcr", reportNumberHint, parsed.fields, {
            ocrSkippedForSufficientText,
            imageOcrMs: timings.imageOcrMs,
            clientExtractionSufficient: clientExtractionSufficient({
              fields: parsed.fields,
              confidence: parsed.confidence,
            }),
            supportsLevel: assessReportCapability({ fields: parsed.fields })
              .supportsLevel,
          });
        }

        console.log("[upload-pipeline] finalizer:start", { ms: Date.now() - t0 });
        const finalizerStarted = Date.now();
        const finalized = finalizeCalibrationExtractionResult({
          parsed,
          combinedText: combined,
          usedImageOCR:
            (ocrAttempted && Boolean(docText)) || timings.imageOcrMs > 0,
          auditSpec:
            !clientMode &&
            (reportNumberHint || parsed.metadata.reportNumber)
              ? {
                  reportNumber:
                    reportNumberHint || parsed.metadata.reportNumber,
                  lab: parsed.metadata.lab,
                  scenarioId: "upload",
                }
              : undefined,
        });
        timings.finalizerMs = Date.now() - finalizerStarted;
        logUploadPipelineTiming({
          phase: "parser-finalizer",
          durationMs: timings.finalizerMs,
          labFamily: timings.labFamily,
          parserPath: finalized.parserType,
        });
        console.log("[upload-pipeline] finalizer:end", {
          ms: Date.now() - t0,
          eligible: finalized.calibrationEligible,
          excluded: finalized.excludedFromCalibrationStats,
        });

        timings.totalMs = Date.now() - pipelineStarted;

        logCalibrationRuntimeCheck({
          operation: "upload-extraction-pipeline",
          parserPath: finalized.parserType,
          durationMs: timings.totalMs,
          ocrDurationMs: timings.imageOcrMs || undefined,
        });

        return assembleOutput(finalized, {
          ocrAttempted,
          ocrAvailable,
          combined,
          renderAudit,
          forensicSnapshots: input.collectForensics
            ? drainForensicSnapshots()
            : undefined,
          gcalSarineDiagramProportionWait:
            snapshot.gcalSarineDiagramProportionWait,
          gcalSarineOcrDiagnostics: snapshot.gcalSarineOcrDiagnostics,
          gcalSarineDiagramOcrFailure: snapshot.gcalSarineDiagramOcrFailure,
        });
        };

        if (clientMode) {
          const diagramProportionWait =
            giaDiagramProportionWait || gcalSarineDiagramProportionWait;
          const totalBudget = diagramProportionWait
            ? (input.pipelineTimeoutMs ??
              CLIENT_GIA_DIAGRAM_PIPELINE_TIMEOUT_MS)
            : (input.pipelineTimeoutMs ?? CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS);
          const ocrPhaseBudget = Math.max(
            totalBudget - (Date.now() - pipelineStarted),
            8_000,
          );
          return await withTimeout(
            runOcrFinalizeAndReturn(),
            ocrPhaseBudget,
            "upload-extraction-pipeline",
          );
        }

        return await runOcrFinalizeAndReturn();
      };

    if (clientMode) {
      return await executeUploadPipeline();
    }

    return await withTimeout(
      executeUploadPipeline(),
      timeoutMs,
      "upload-extraction-pipeline",
    );
  } catch (err) {
    const timedOut = err instanceof CalibrationTimeoutError;
    timings.totalMs = Date.now() - pipelineStarted;
    logCalibrationRuntimeCheck({
      operation: "upload-extraction-pipeline",
      durationMs: timings.totalMs,
      timedOut,
      error: timeoutErrorMessage(err),
    });

    // On timeout in client mode, return whatever snapshot we built so the
    // route can classify it deterministically (full / partial / failure).
    if (clientMode && snapshot.parsed) {
      const parsedForFinalize: ExtractionResult = {
        ...snapshot.parsed,
        rawTextSnippet:
          snapshot.parsed.rawTextSnippet || snapshot.combined.slice(0, 1200),
        reportGradeHintText: (
          snapshot.gradeHintText || snapshot.combined
        ).slice(0, 16000),
      };
      const finalized = finalizeCalibrationExtractionResult({
        parsed: parsedForFinalize,
        combinedText: snapshot.combined,
        usedImageOCR: snapshot.ocrAttempted || timings.imageOcrMs > 0,
      });
      const diagramWaitTimedOut =
        (Boolean(snapshot.giaDiagramProportionWait) ||
          Boolean(snapshot.gcalSarineDiagramProportionWait)) &&
        !assessExtractionCompleteness({ fields: finalized.fields })
          .scoreEligible;
      logUploadPipelineTiming({
        phase: "parser-finalizer",
        durationMs: 0,
        labFamily: timings.labFamily,
        parserPath: finalized.parserType,
        detail: diagramWaitTimedOut
          ? "diagram-ocr-timeout"
          : "snapshot-after-timeout",
      });
      return assembleOutput(finalized, {
        ocrAttempted: snapshot.ocrAttempted,
        ocrAvailable: snapshot.ocrAvailable,
        combined: snapshot.combined,
        clientPartial: !diagramWaitTimedOut,
        timedOut: true,
        diagramOcrTimedOut: diagramWaitTimedOut,
        pipelineError: timeoutErrorMessage(err),
        gcalSarineDiagramProportionWait:
          snapshot.gcalSarineDiagramProportionWait,
        gcalSarineOcrDiagnostics: snapshot.gcalSarineOcrDiagnostics,
        gcalSarineDiagramOcrFailure: snapshot.gcalSarineDiagramOcrFailure,
      });
    }

    if (
      clientMode &&
      timedOut &&
      !snapshot.parsed &&
      process.env.NODE_ENV === "development"
    ) {
      const errMsg = timeoutErrorMessage(err);
      console.log("[upload-pipeline] client-timeout-before-parser", {
        documentExtractMs: timings.documentExtractMs,
        pipelineError: errMsg,
        preParser: errMsg.includes("document-extract"),
      });
    }

    const empty = extractFieldsFromReportText("", {
      lab: input.lab,
      reportNumber: input.reportNumber,
      reportSource: input.reportSource ?? "manual",
    });

    const finalized = finalizeCalibrationExtractionResult({
      parsed: empty,
      combinedText: "",
      usedImageOCR: false,
      auditSpec:
        !clientMode && input.reportNumber && input.lab
          ? {
              reportNumber: input.reportNumber,
              lab: input.lab as never,
              scenarioId: "upload-timeout",
            }
          : undefined,
    });

    return assembleOutput(finalized, {
      ocrAttempted: false,
      ocrAvailable: false,
      combined: "",
      timedOut,
      pipelineError: timeoutErrorMessage(err),
    });
  } finally {
    setForensicCollectionEnabled(false);
  }
}
