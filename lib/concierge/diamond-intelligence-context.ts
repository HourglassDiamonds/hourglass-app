import type { ListingExtraction } from "@/lib/diamond-intelligence/url-ingestion/types";

export type DiamondIntelligenceConciergeSourceType = "upload" | "url";

export type DiamondIntelligenceConciergeContext = {
  lab?: string | null;
  reportNumber?: string | null;
  carat?: string | null;
  shape?: string | null;
  color?: string | null;
  clarity?: string | null;
  cut?: string | null;
  polish?: string | null;
  symmetry?: string | null;
  fluorescence?: string | null;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  sourceType?: DiamondIntelligenceConciergeSourceType | null;
  verdict?: string | null;
  submissionId?: string | null;
};

const CONCIERGE_PARAM_KEYS = {
  source: "source",
  lab: "lab",
  report: "report",
  carat: "carat",
  shape: "shape",
  color: "color",
  clarity: "clarity",
  cut: "cut",
  polish: "polish",
  symmetry: "symmetry",
  fluorescence: "fluorescence",
  url: "url",
  vendor: "vendor",
  sourceType: "stype",
  verdict: "verdict",
  submissionId: "sid",
} as const;

function trimOrNull(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

function formatCaratQuery(carat: string | null | undefined): string | null {
  const v = trimOrNull(carat);
  if (!v) return null;
  return v.includes("ct") ? v : `${v} ct`;
}

function setParamIfPresent(
  params: URLSearchParams,
  key: string,
  value: string | null | undefined,
) {
  const v = trimOrNull(value);
  if (v) params.set(key, v);
}

export function buildConciergeContextFromListing(
  listing: ListingExtraction,
  options?: { verdict?: string | null },
): DiamondIntelligenceConciergeContext {
  return {
    lab: listing.lab,
    reportNumber: listing.reportNumber,
    carat: listing.carat != null ? String(listing.carat) : null,
    shape: listing.shape,
    color: listing.color,
    clarity: listing.clarity,
    cut: listing.cut,
    polish: listing.polish,
    symmetry: listing.symmetry,
    fluorescence: listing.fluorescence,
    sourceUrl: listing.canonicalUrl ?? listing.url,
    sourceLabel: formatVendorDisplayName(listing.vendor),
    sourceType: "url",
    verdict: options?.verdict ?? null,
  };
}

export function buildConciergeContextFromReport(input: {
  metadata?: {
    lab?: string | null;
    reportNumber?: string | null;
  } | null;
  fields?: {
    carat?: string | null;
    shape?: string | null;
    cutGrade?: string | null;
    polish?: string | null;
    symmetry?: string | null;
    fluorescence?: string | null;
  } | null;
  gradeHints?: {
    color?: string | null;
    clarity?: string | null;
  } | null;
  ingestMode?: "url" | "upload";
  sourceUrl?: string | null;
  activeListing?: ListingExtraction | null;
  uploadFileName?: string | null;
  verdict?: string | null;
}): DiamondIntelligenceConciergeContext {
  const listing = input.activeListing;
  const fromListing = listing ? buildConciergeContextFromListing(listing) : null;

  const sourceUrl =
    trimOrNull(input.sourceUrl) ??
    fromListing?.sourceUrl ??
    null;

  const sourceType: DiamondIntelligenceConciergeSourceType | null =
    input.ingestMode === "url" || fromListing
      ? "url"
      : input.ingestMode === "upload"
        ? "upload"
        : null;

  const sourceLabel =
    fromListing?.sourceLabel ??
    (sourceType === "upload"
      ? trimOrNull(input.uploadFileName)
        ? `Uploaded Report (${trimOrNull(input.uploadFileName)})`
        : "Uploaded Report"
      : sourceType === "url"
        ? "Listing URL"
        : null);

  return {
    lab: input.metadata?.lab ?? fromListing?.lab ?? null,
    reportNumber: input.metadata?.reportNumber ?? fromListing?.reportNumber ?? null,
    carat: input.fields?.carat ?? fromListing?.carat ?? null,
    shape: input.fields?.shape ?? fromListing?.shape ?? null,
    color: input.gradeHints?.color ?? fromListing?.color ?? null,
    clarity: input.gradeHints?.clarity ?? fromListing?.clarity ?? null,
    cut: input.fields?.cutGrade ?? fromListing?.cut ?? null,
    polish: input.fields?.polish ?? fromListing?.polish ?? null,
    symmetry: input.fields?.symmetry ?? fromListing?.symmetry ?? null,
    fluorescence: input.fields?.fluorescence ?? fromListing?.fluorescence ?? null,
    sourceUrl,
    sourceLabel,
    sourceType,
    verdict: input.verdict ?? null,
  };
}

export function formatVendorDisplayName(vendorId: string | null | undefined): string {
  const id = vendorId?.trim();
  if (!id || id === "unknown") return "Listing";
  return id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildConciergeHrefFromDiamondIntelligence(
  ctx: DiamondIntelligenceConciergeContext,
): string {
  const params = new URLSearchParams();
  params.set(CONCIERGE_PARAM_KEYS.source, "diamond-intelligence");
  params.set("tool", "diamond-intelligence");

  setParamIfPresent(params, CONCIERGE_PARAM_KEYS.lab, ctx.lab);
  setParamIfPresent(params, CONCIERGE_PARAM_KEYS.report, ctx.reportNumber);
  setParamIfPresent(
    params,
    CONCIERGE_PARAM_KEYS.carat,
    formatCaratQuery(ctx.carat),
  );
  setParamIfPresent(params, CONCIERGE_PARAM_KEYS.shape, ctx.shape);
  setParamIfPresent(params, CONCIERGE_PARAM_KEYS.color, ctx.color);
  setParamIfPresent(params, CONCIERGE_PARAM_KEYS.clarity, ctx.clarity);
  setParamIfPresent(params, CONCIERGE_PARAM_KEYS.cut, ctx.cut);
  setParamIfPresent(params, CONCIERGE_PARAM_KEYS.polish, ctx.polish);
  setParamIfPresent(params, CONCIERGE_PARAM_KEYS.symmetry, ctx.symmetry);
  setParamIfPresent(params, CONCIERGE_PARAM_KEYS.fluorescence, ctx.fluorescence);
  setParamIfPresent(params, CONCIERGE_PARAM_KEYS.url, ctx.sourceUrl);
  setParamIfPresent(params, CONCIERGE_PARAM_KEYS.vendor, ctx.sourceLabel);
  setParamIfPresent(params, CONCIERGE_PARAM_KEYS.sourceType, ctx.sourceType);
  setParamIfPresent(params, CONCIERGE_PARAM_KEYS.verdict, ctx.verdict);
  setParamIfPresent(params, CONCIERGE_PARAM_KEYS.submissionId, ctx.submissionId);

  const qs = params.toString();
  return qs ? `/concierge?${qs}` : "/concierge";
}

function formatReportLine(ctx: DiamondIntelligenceConciergeContext): string | null {
  const lab = trimOrNull(ctx.lab);
  const report = trimOrNull(ctx.reportNumber);
  if (lab && report) return `${lab} ${report}`;
  if (lab) return lab;
  if (report) return report;
  return null;
}

function formatDiamondBlock(ctx: DiamondIntelligenceConciergeContext): string[] {
  const lines: string[] = [];
  const carat = formatCaratQuery(ctx.carat);
  const shape = trimOrNull(ctx.shape);
  const identity = [carat, shape].filter(Boolean).join(" ");
  if (identity) lines.push(identity);

  const color = trimOrNull(ctx.color);
  const clarity = trimOrNull(ctx.clarity);
  if (color || clarity) {
    lines.push([color ?? "—", clarity ?? "—"].join(" / "));
  }

  const cut = trimOrNull(ctx.cut);
  const polish = trimOrNull(ctx.polish);
  const symmetry = trimOrNull(ctx.symmetry);
  const fluorescence = trimOrNull(ctx.fluorescence);

  if (cut) lines.push(`Cut: ${cut}`);
  if (polish) lines.push(`Polish: ${polish}`);
  if (symmetry) lines.push(`Symmetry: ${symmetry}`);
  if (fluorescence) lines.push(`Fluorescence: ${fluorescence}`);

  return lines;
}

export function buildDiamondIntelligenceNotesPrefill(
  ctx: DiamondIntelligenceConciergeContext,
): string {
  const hasAnyDetail = [
    ctx.lab,
    ctx.reportNumber,
    ctx.carat,
    ctx.shape,
    ctx.color,
    ctx.clarity,
    ctx.cut,
    ctx.polish,
    ctx.symmetry,
    ctx.fluorescence,
    ctx.sourceUrl,
    ctx.sourceLabel,
    ctx.verdict,
    ctx.submissionId,
  ].some((value) => trimOrNull(value ?? undefined));

  if (!hasAnyDetail) {
    return "I'd like Justin to review this diamond.";
  }

  const sections: string[] = ["I'd like Justin to review this diamond.", ""];

  const sourceLabel =
    trimOrNull(ctx.sourceLabel) ??
    (ctx.sourceType === "upload" ? "Uploaded Report" : null);
  if (sourceLabel) {
    sections.push("Source:", sourceLabel, "");
  }

  const sourceUrl = trimOrNull(ctx.sourceUrl);
  if (sourceUrl) {
    sections.push("URL:", sourceUrl, "");
  }

  const reportLine = formatReportLine(ctx);
  if (reportLine) {
    sections.push("Report:", reportLine, "");
  }

  const diamondLines = formatDiamondBlock(ctx);
  if (diamondLines.length > 0) {
    sections.push("Diamond:", ...diamondLines, "");
  }

  const verdict = trimOrNull(ctx.verdict);
  if (verdict) {
    sections.push("Diamond Intelligence result:", verdict, "");
  }

  const submissionId = trimOrNull(ctx.submissionId);
  if (submissionId) {
    sections.push("Submission ID:", submissionId);
  }

  return sections.join("\n").trimEnd();
}

export function conciergeContextFromSearchParams(
  searchParams: URLSearchParams,
): DiamondIntelligenceConciergeContext | null {
  if (searchParams.get(CONCIERGE_PARAM_KEYS.source) !== "diamond-intelligence") {
    return null;
  }

  const sourceType = searchParams.get(CONCIERGE_PARAM_KEYS.sourceType);
  return {
    lab: searchParams.get(CONCIERGE_PARAM_KEYS.lab),
    reportNumber: searchParams.get(CONCIERGE_PARAM_KEYS.report),
    carat: searchParams.get(CONCIERGE_PARAM_KEYS.carat),
    shape: searchParams.get(CONCIERGE_PARAM_KEYS.shape),
    color: searchParams.get(CONCIERGE_PARAM_KEYS.color),
    clarity: searchParams.get(CONCIERGE_PARAM_KEYS.clarity),
    cut: searchParams.get(CONCIERGE_PARAM_KEYS.cut),
    polish: searchParams.get(CONCIERGE_PARAM_KEYS.polish),
    symmetry: searchParams.get(CONCIERGE_PARAM_KEYS.symmetry),
    fluorescence: searchParams.get(CONCIERGE_PARAM_KEYS.fluorescence),
    sourceUrl: searchParams.get(CONCIERGE_PARAM_KEYS.url),
    sourceLabel: searchParams.get(CONCIERGE_PARAM_KEYS.vendor),
    sourceType:
      sourceType === "upload" || sourceType === "url" ? sourceType : null,
    verdict: searchParams.get(CONCIERGE_PARAM_KEYS.verdict),
    submissionId: searchParams.get(CONCIERGE_PARAM_KEYS.submissionId),
  };
}

export function diamondIntelligencePrefillFromSearchParams(
  searchParams: URLSearchParams,
): string | null {
  const ctx = conciergeContextFromSearchParams(searchParams);
  if (!ctx) return null;
  return buildDiamondIntelligenceNotesPrefill(ctx);
}
