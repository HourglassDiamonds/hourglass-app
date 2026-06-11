import type { ListingExtraction } from "./types";

export type PartialListing = Partial<
  Omit<ListingExtraction, "vendor" | "url" | "canonicalUrl" | "extractedAt">
>;

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function parsePrice(value: unknown): { price: number | null; currency: string | null } {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { price: value, currency: "USD" };
  }
  if (typeof value !== "string") return { price: null, currency: null };
  const match = value.replace(/,/g, "").match(/([$€£])?\s*([\d.]+)/);
  if (!match?.[2]) return { price: null, currency: null };
  const price = parseFloat(match[2]);
  const currency =
    match[1] === "€" ? "EUR" : match[1] === "£" ? "GBP" : "USD";
  return { price: Number.isFinite(price) ? price : null, currency };
}

function parseCarat(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.match(/([\d.]+)\s*(?:ct|carat)/i) ?? value.match(/^([\d.]+)$/);
  if (!match?.[1]) return null;
  const carat = parseFloat(match[1]);
  return Number.isFinite(carat) ? carat : null;
}

export function extractMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const tagRe =
    /<meta\s+[^>]*(?:property|name)\s*=\s*["']([^"']+)["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/gi;
  const tagReAlt =
    /<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*(?:property|name)\s*=\s*["']([^"']+)["'][^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    meta[match[1]!.toLowerCase()] = match[2]!;
  }
  while ((match = tagReAlt.exec(html))) {
    meta[match[2]!.toLowerCase()] = match[1]!;
  }
  return meta;
}

export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re =
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // skip malformed JSON-LD
    }
  }
  return blocks;
}

export function extractNextData(html: string): unknown | null {
  const match = html.match(
    /<script[^>]*id\s*=\s*["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function flattenJsonLd(nodes: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj["@graph"])) {
      for (const item of obj["@graph"]) {
        if (item && typeof item === "object") out.push(item as Record<string, unknown>);
      }
    } else {
      out.push(obj);
    }
  }
  return out;
}

function fromJsonLdProduct(product: Record<string, unknown>): PartialListing {
  const offers = product.offers;
  const offer =
    Array.isArray(offers) ? offers[0] : offers && typeof offers === "object" ? offers : null;
  const offerObj = offer as Record<string, unknown> | null;
  const { price, currency } = parsePrice(
    offerObj?.price ?? offerObj?.lowPrice ?? product.price,
  );

  const additional = product.additionalProperty;
  const props: Record<string, string> = {};
  if (Array.isArray(additional)) {
    for (const item of additional) {
      if (item && typeof item === "object") {
        const p = item as Record<string, unknown>;
        const name = firstString(p.name, p.propertyID);
        const value = firstString(p.value);
        if (name && value) props[name.toLowerCase()] = value;
      }
    }
  }

  const description = firstString(product.description);
  const name = firstString(product.name);

  return {
    price,
    currency: firstString(offerObj?.priceCurrency) ?? currency,
    shape: props.shape ?? extractFromText(name, /(round|oval|cushion|princess|emerald|pear|marquise|radiant|asscher|heart)/i),
    carat:
      parseCarat(props.carat ?? props["carat weight"] ?? props.weight) ??
      parseCarat(description) ??
      parseCarat(name),
    color: props.color ?? extractGradeFromText(description ?? name, "color"),
    clarity: props.clarity ?? extractGradeFromText(description ?? name, "clarity"),
    cut: props.cut ?? extractGradeFromText(description ?? name, "cut"),
    polish: props.polish ?? null,
    symmetry: props.symmetry ?? null,
    fluorescence: props.fluorescence ?? null,
    lab: props.lab ?? props.certificate ?? extractLabFromText(description ?? name),
    reportNumber: props["report number"] ?? props.reportnumber ?? null,
    imageUrl: firstString(
      Array.isArray(product.image) ? product.image[0] : product.image,
    ),
    availability: firstString(offerObj?.availability),
    rawJsonLd: product,
  };
}

function extractFromText(text: string | null, pattern: RegExp): string | null {
  if (!text) return null;
  const match = text.match(pattern);
  return match?.[1] ? capitalize(match[1]) : null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function extractGradeFromText(
  text: string | null,
  kind: "color" | "clarity" | "cut",
): string | null {
  if (!text) return null;
  if (kind === "color") {
    const m = text.match(/\b([D-Z])\b/);
    return m?.[1] ?? null;
  }
  if (kind === "clarity") {
    const m = text.match(/\b(FL|IF|VVS[12]|VS[12]|SI[12]|I[123])\b/i);
    return m?.[1]?.toUpperCase() ?? null;
  }
  const m = text.match(/\b(Excellent|Very Good|Good|Fair|Poor|Ideal|Super Ideal)\b/i);
  return m?.[1] ? capitalize(m[1].replace(/\s+/g, " ")) : null;
}

function extractLabFromText(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(/\b(GIA|IGI|GCAL|AGS|HRD)\b/i);
  return m?.[1]?.toUpperCase() ?? null;
}

export function extractFromStructuredData(html: string): PartialListing {
  const partial: PartialListing = {
    extractionWarnings: [],
  };

  const meta = extractMetaTags(html);
  partial.rawMetadata = meta;

  const ogTitle = meta["og:title"] ?? meta["twitter:title"];
  const ogDesc = meta["og:description"] ?? meta["description"];
  const { price, currency } = parsePrice(meta["product:price:amount"] ?? meta["og:price:amount"]);
  partial.price = price;
  partial.currency = meta["product:price:currency"] ?? meta["og:price:currency"] ?? currency;
  partial.imageUrl = meta["og:image"] ?? null;
  partial.shape = extractFromText(ogTitle ?? ogDesc ?? null, /(round|oval|cushion|princess|emerald|pear|marquise|radiant|asscher|heart)/i);
  partial.carat = parseCarat(ogTitle ?? ogDesc ?? null);
  partial.color = extractGradeFromText(ogDesc ?? ogTitle ?? null, "color");
  partial.clarity = extractGradeFromText(ogDesc ?? ogTitle ?? null, "clarity");
  partial.cut = extractGradeFromText(ogDesc ?? ogTitle ?? null, "cut");
  partial.lab = extractLabFromText(ogDesc ?? ogTitle ?? null);

  const jsonLd = flattenJsonLd(extractJsonLdBlocks(html));
  const product = jsonLd.find(
    (node) =>
      node["@type"] === "Product" ||
      (Array.isArray(node["@type"]) && node["@type"].includes("Product")),
  );
  if (product) {
    const fromProduct = fromJsonLdProduct(product);
    Object.assign(partial, mergePartialListing(partial, fromProduct));
  }

  const nextData = extractNextData(html);
  if (nextData) {
    const fromNext = extractFromAppState(nextData);
    Object.assign(partial, mergePartialListing(partial, fromNext));
  }

  const reportUrl = findReportUrlInHtml(html);
  if (reportUrl) {
    partial.reportUrl = reportUrl;
    partial.certificateUrl = reportUrl;
  }

  partial.rawHtmlSnippet = html.slice(0, 4000);
  return partial;
}

function extractFromAppState(state: unknown): PartialListing {
  const partial: PartialListing = {};
  const text = JSON.stringify(state);

  partial.carat = parseCarat(text);
  partial.color = extractGradeFromText(text, "color");
  partial.clarity = extractGradeFromText(text, "clarity");
  partial.cut = extractGradeFromText(text, "cut");
  partial.lab = extractLabFromText(text);

  const reportMatch = text.match(
    /"(?:certificateUrl|reportUrl|pdfUrl|giaReportUrl|certificateLink)"\s*:\s*"([^"]+)"/i,
  );
  if (reportMatch?.[1]) {
    partial.reportUrl = decodeJsonString(reportMatch[1]);
    partial.certificateUrl = partial.reportUrl;
  }

  const reportNumberMatch = text.match(
    /"(?:reportNumber|certificateNumber|giaNumber)"\s*:\s*"([^"]+)"/i,
  );
  if (reportNumberMatch?.[1]) {
    partial.reportNumber = decodeJsonString(reportNumberMatch[1]);
  }

  const priceMatch = text.match(/"(?:price|salePrice|listPrice)"\s*:\s*([\d.]+)/i);
  if (priceMatch?.[1]) {
    partial.price = parseFloat(priceMatch[1]);
    partial.currency = "USD";
  }

  return partial;
}

function decodeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
}

function findReportUrlInHtml(html: string): string | null {
  const patterns = [
    /href\s*=\s*["']([^"']+\.pdf[^"']*)["']/gi,
    /"(?:certificateUrl|reportUrl|pdfUrl|giaReportUrl)"\s*:\s*"([^"]+)"/gi,
    /(https?:\/\/[^\s"'<>]+\.pdf)/gi,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      const url = match[1].replace(/\\u002F/g, "/").replace(/\\\//g, "/");
      if (url.startsWith("http")) return url;
    }
  }
  return null;
}

export function mergePartialListing(
  base: PartialListing,
  overlay: PartialListing,
): PartialListing {
  const merged: PartialListing = { ...base, ...overlay };
  merged.extractionWarnings = [
    ...(base.extractionWarnings ?? []),
    ...(overlay.extractionWarnings ?? []),
  ];
  for (const key of Object.keys(overlay) as (keyof PartialListing)[]) {
    const value = overlay[key];
    if (value !== null && value !== undefined && value !== "") {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

export function scoreExtractionConfidence(
  listing: Omit<ListingExtraction, "extractionConfidence">,
): ListingExtraction["extractionConfidence"] {
  const coreFields = [
    listing.carat,
    listing.color,
    listing.clarity,
    listing.shape,
    listing.price,
  ].filter((v) => v !== null && v !== undefined);

  if (coreFields.length >= 4 || (listing.reportUrl && listing.lab)) return "high";
  if (coreFields.length >= 2) return "medium";
  return "low";
}

export function normalizeListingExtraction(input: {
  vendor: ListingExtraction["vendor"];
  url: string;
  canonicalUrl: string;
  listingId: string | null;
  partial: PartialListing;
}): ListingExtraction {
  const base: Omit<ListingExtraction, "extractionConfidence"> = {
    vendor: input.vendor,
    url: input.url,
    canonicalUrl: input.canonicalUrl,
    listingId: input.listingId,
    price: input.partial.price ?? null,
    currency: input.partial.currency ?? null,
    shape: input.partial.shape ?? null,
    carat: input.partial.carat ?? null,
    color: input.partial.color ?? null,
    clarity: input.partial.clarity ?? null,
    cut: input.partial.cut ?? null,
    polish: input.partial.polish ?? null,
    symmetry: input.partial.symmetry ?? null,
    fluorescence: input.partial.fluorescence ?? null,
    lab: input.partial.lab ?? null,
    reportNumber: input.partial.reportNumber ?? null,
    reportUrl: input.partial.reportUrl ?? null,
    certificateUrl: input.partial.certificateUrl ?? null,
    imageUrl: input.partial.imageUrl ?? null,
    videoUrl: input.partial.videoUrl ?? null,
    availability: input.partial.availability ?? null,
    extractedAt: new Date().toISOString(),
    extractionWarnings: input.partial.extractionWarnings ?? [],
    rawHtmlSnippet: input.partial.rawHtmlSnippet,
    rawJsonLd: input.partial.rawJsonLd,
    rawMetadata: input.partial.rawMetadata,
  };

  return {
    ...base,
    extractionConfidence: scoreExtractionConfidence(base),
  };
}
