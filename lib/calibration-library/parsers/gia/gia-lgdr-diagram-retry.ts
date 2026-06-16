import type { ReportFieldKey } from "../../types";
import { ocrImageBuffer, type RenderedPdfPage } from "../shared/ocr-utils";
import {
  GIA_LGDR_DOSSIER_DIAGRAM_REGION,
  GIA_LGDR_DOSSIER_VALUE_BANDS,
  type GiaDiagramBandDef,
} from "./gia-report-style";
import { cropRegionPng, preprocessCropPng } from "./gia-diagram-crop";
import {
  parseGiaDiagramFieldsFromBands,
  type GiaDiagramBandOcr,
  type GiaDiagramFieldResult,
} from "./gia-diagram-extraction";

const LGDR_RETRY_TARGET_FIELDS = [
  "depthPercent",
  "girdle",
  "culet",
] as const satisfies readonly ReportFieldKey[];

const SNIPPET_MAX_LEN = 120;

export type LgdrDiagramRetryBandSnippets = {
  stack?: { firstPass: string; retry: string };
  lgdrDiagramRegion?: { firstPass: string; retry: string };
};

export type LgdrDiagramRetryDiagnostic = {
  lgdrDiagramRetryAttempted: boolean;
  lgdrDiagramRetryRecoveredFields: ReportFieldKey[];
  lgdrDiagramRetryBandSnippets: LgdrDiagramRetryBandSnippets;
};

function fieldParsedValue(
  rows: GiaDiagramFieldResult[],
  field: ReportFieldKey,
): string {
  return rows.find((r) => r.field === field)?.parsedValue?.trim() ?? "";
}

/** LGDR diagram partial failure: core angles/table present, depth/girdle/culet missing. */
export function isLgdrDiagramPartialFailurePattern(
  fields: GiaDiagramFieldResult[],
): boolean {
  const has = (field: ReportFieldKey) =>
    Boolean(fieldParsedValue(fields, field));
  const missing = (field: ReportFieldKey) =>
    !fieldParsedValue(fields, field);
  return (
    has("tablePercent") &&
    has("crownAngle") &&
    has("pavilionAngle") &&
    missing("depthPercent") &&
    missing("girdle") &&
    missing("culet")
  );
}

export function redactLgdrBandSnippet(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, SNIPPET_MAX_LEN);
}

function findBandDef(id: string): GiaDiagramBandDef | undefined {
  if (id === "lgdr-diagram-region") {
    return {
      id: "lgdr-diagram-region",
      crop: GIA_LGDR_DOSSIER_DIAGRAM_REGION,
      expects: [
        "tablePercent",
        "depthPercent",
        "crownAngle",
        "pavilionAngle",
        "girdle",
        "culet",
      ],
      preprocess: "threshold",
      scale: 6,
    };
  }
  return GIA_LGDR_DOSSIER_VALUE_BANDS.find((b) => b.id === id);
}

async function ocrBandWithAlternatePreprocess(
  png: Buffer,
  primaryMode: GiaDiagramBandDef["preprocess"],
): Promise<string> {
  const modes: GiaDiagramBandDef["preprocess"][] =
    primaryMode === "contrast"
      ? ["contrast", "threshold"]
      : ["contrast", "threshold", "raw"];
  const parts: string[] = [];
  const rawOcr = await ocrImageBuffer(png);
  if (rawOcr.text.trim()) parts.push(rawOcr.text.trim());
  for (const mode of modes) {
    const prepped = await preprocessCropPng(png, mode);
    const ocr = await ocrImageBuffer(prepped);
    if (ocr.text.trim()) parts.push(ocr.text.trim());
  }
  return [...new Set(parts)].join("\n").trim();
}

export function mergeLgdrRetryBandTexts(
  bands: GiaDiagramBandOcr[],
  updates: Partial<Record<"stack" | "lgdr-diagram-region", string>>,
): GiaDiagramBandOcr[] {
  return bands.map((band) => {
    const retryText = updates[band.id as keyof typeof updates];
    if (!retryText?.trim()) return band;
    const merged = [band.text, retryText].filter(Boolean).join("\n").trim();
    return { ...band, text: merged };
  });
}

export function mergeLgdrRetryParsedFields(
  initialFields: GiaDiagramFieldResult[],
  mergedBands: GiaDiagramBandOcr[],
): { fields: GiaDiagramFieldResult[]; recoveredFields: ReportFieldKey[] } {
  const reparsed = parseGiaDiagramFieldsFromBands(mergedBands, "GIA_LGDR_DOSSIER");
  const recoveredFields: ReportFieldKey[] = [];
  const fields = initialFields.map((row) => {
    if (
      !LGDR_RETRY_TARGET_FIELDS.includes(
        row.field as (typeof LGDR_RETRY_TARGET_FIELDS)[number],
      )
    ) {
      return row;
    }
    if (row.parsedValue?.trim()) return row;
    const retryRow = reparsed.find((r) => r.field === row.field);
    if (!retryRow?.parsedValue?.trim()) return row;
    recoveredFields.push(row.field);
    return retryRow;
  });
  return { fields, recoveredFields };
}

/** Test seam — apply retry band text without image IO. */
export function applyLgdrDiagramRetryFromBandText(input: {
  bands: GiaDiagramBandOcr[];
  fields: GiaDiagramFieldResult[];
  retryTexts: Partial<Record<"stack" | "lgdr-diagram-region", string>>;
  firstPassSnippets?: LgdrDiagramRetryBandSnippets;
}): {
  fields: GiaDiagramFieldResult[];
  bands: GiaDiagramBandOcr[];
  diagnostic: LgdrDiagramRetryDiagnostic;
} {
  const stackFirst =
    input.bands.find((b) => b.id === "stack")?.text ?? "";
  const regionFirst =
    input.bands.find((b) => b.id === "lgdr-diagram-region")?.text ?? "";
  const mergedBands = mergeLgdrRetryBandTexts(input.bands, input.retryTexts);
  const { fields, recoveredFields } = mergeLgdrRetryParsedFields(
    input.fields,
    mergedBands,
  );
  const diagnostic: LgdrDiagramRetryDiagnostic = {
    lgdrDiagramRetryAttempted: true,
    lgdrDiagramRetryRecoveredFields: recoveredFields,
    lgdrDiagramRetryBandSnippets: {
      stack: input.retryTexts.stack
        ? {
            firstPass: redactLgdrBandSnippet(
              input.firstPassSnippets?.stack?.firstPass ?? stackFirst,
            ),
            retry: redactLgdrBandSnippet(input.retryTexts.stack),
          }
        : undefined,
      lgdrDiagramRegion: input.retryTexts["lgdr-diagram-region"]
        ? {
            firstPass: redactLgdrBandSnippet(
              input.firstPassSnippets?.lgdrDiagramRegion?.firstPass ??
                regionFirst,
            ),
            retry: redactLgdrBandSnippet(
              input.retryTexts["lgdr-diagram-region"],
            ),
          }
        : undefined,
    },
  };
  return { fields, bands: mergedBands, diagnostic };
}

export async function attemptLgdrDiagramOcrRetry(input: {
  rendered: RenderedPdfPage;
  bands: GiaDiagramBandOcr[];
  fields: GiaDiagramFieldResult[];
  bandCropPngs: Array<{ id: string; raw: Buffer }>;
}): Promise<{
  fields: GiaDiagramFieldResult[];
  bands: GiaDiagramBandOcr[];
  diagnostic: LgdrDiagramRetryDiagnostic;
} | null> {
  if (!isLgdrDiagramPartialFailurePattern(input.fields)) return null;

  const retryTexts: Partial<Record<"stack" | "lgdr-diagram-region", string>> =
    {};
  const snippets: LgdrDiagramRetryBandSnippets = {};

  for (const bandId of ["stack", "lgdr-diagram-region"] as const) {
    const band = input.bands.find((b) => b.id === bandId);
    const cropEntry = input.bandCropPngs.find((b) => b.id === bandId);
    const bandDef = findBandDef(bandId);
    if (!bandDef) continue;

    let png = cropEntry?.raw;
    if (!png) {
      const cropped = await cropRegionPng(input.rendered, bandDef.crop);
      png = cropped?.png;
    }
    if (!png) continue;

    const firstPass = band?.text ?? "";
    const retryText = await ocrBandWithAlternatePreprocess(
      png,
      bandDef.preprocess,
    );
    if (!retryText.trim()) continue;
    retryTexts[bandId] = retryText;

    const snippet = {
      firstPass: redactLgdrBandSnippet(firstPass),
      retry: redactLgdrBandSnippet(retryText),
    };
    if (bandId === "stack") snippets.stack = snippet;
    else snippets.lgdrDiagramRegion = snippet;
  }

  if (Object.keys(retryTexts).length === 0) {
    return {
      fields: input.fields,
      bands: input.bands,
      diagnostic: {
        lgdrDiagramRetryAttempted: true,
        lgdrDiagramRetryRecoveredFields: [],
        lgdrDiagramRetryBandSnippets: snippets,
      },
    };
  }

  return applyLgdrDiagramRetryFromBandText({
    bands: input.bands,
    fields: input.fields,
    retryTexts,
    firstPassSnippets: snippets,
  });
}
