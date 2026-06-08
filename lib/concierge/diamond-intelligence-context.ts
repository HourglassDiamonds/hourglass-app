export type DiamondIntelligenceConciergeContext = {
  lab?: string | null;
  reportNumber?: string | null;
  carat?: string | null;
  shape?: string | null;
};

function formatCaratQuery(carat: string | null | undefined): string | null {
  const v = carat?.trim();
  if (!v) return null;
  return v.includes("ct") ? v : `${v} ct`;
}

export function buildConciergeHrefFromDiamondIntelligence(
  ctx: DiamondIntelligenceConciergeContext,
): string {
  const params = new URLSearchParams();
  params.set("source", "diamond-intelligence");

  const lab = ctx.lab?.trim();
  const report = ctx.reportNumber?.trim();
  const carat = formatCaratQuery(ctx.carat);
  const shape = ctx.shape?.trim();

  if (lab) params.set("lab", lab);
  if (report) params.set("report", report);
  if (carat) params.set("carat", carat);
  if (shape) params.set("shape", shape);

  const qs = params.toString();
  return qs ? `/concierge?${qs}` : "/concierge";
}

export function buildDiamondIntelligenceNotesPrefill(
  ctx: DiamondIntelligenceConciergeContext,
): string {
  const lab = ctx.lab?.trim();
  const report = ctx.reportNumber?.trim();
  const carat = formatCaratQuery(ctx.carat);
  const shape = ctx.shape?.trim();

  if (!lab && !report && !carat && !shape) {
    return "I'd like Justin's perspective on this diamond.";
  }

  let detail = "";
  if (lab && report) {
    detail = `${lab} report ${report}`;
  } else if (lab) {
    detail = lab;
  } else if (report) {
    detail = `report ${report}`;
  }

  const tail = [carat, shape].filter(Boolean).join(" ");
  if (detail && tail) {
    detail = `${detail}, ${tail}`;
  } else if (tail) {
    detail = tail;
  }

  return `I'd like Justin's perspective on this diamond: ${detail}.`;
}

export function diamondIntelligencePrefillFromSearchParams(
  searchParams: URLSearchParams,
): string | null {
  if (searchParams.get("source") !== "diamond-intelligence") return null;
  return buildDiamondIntelligenceNotesPrefill({
    lab: searchParams.get("lab"),
    reportNumber: searchParams.get("report"),
    carat: searchParams.get("carat"),
    shape: searchParams.get("shape"),
  });
}
