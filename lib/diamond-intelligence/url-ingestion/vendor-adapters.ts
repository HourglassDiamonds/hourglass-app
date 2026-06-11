import type { DiamondVendorId } from "./types";
import {
  extractFromStructuredData,
  mergePartialListing,
  type PartialListing,
} from "./structured-extractors";

type VendorAdapter = (html: string, url: string) => PartialListing;

function extractLabeledValue(html: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(
      `${label}\\s*</[^>]+>\\s*<[^>]+>\\s*([^<]+)`,
      "i",
    );
    const match = html.match(re);
    if (match?.[1]?.trim()) return match[1].trim();

    const inline = new RegExp(`${label}\\s*[:\\-]\\s*([A-Za-z0-9.+/\\s-]+)`, "i");
    const inlineMatch = html.match(inline);
    if (inlineMatch?.[1]?.trim()) return inlineMatch[1].trim();
  }
  return null;
}

function parseCaratFromText(text: string | null): number | null {
  if (!text) return null;
  const match = text.match(/([\d.]+)\s*(?:ct|carat)?/i);
  if (!match?.[1]) return null;
  const value = parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

const jamesAllenAdapter: VendorAdapter = (html, url) => {
  const partial = extractFromStructuredData(html);
  const caratText = extractLabeledValue(html, ["Carat", "Carat Weight"]);
  const shape = extractLabeledValue(html, ["Shape"]);
  const color = extractLabeledValue(html, ["Color"]);
  const clarity = extractLabeledValue(html, ["Clarity"]);
  const cut = extractLabeledValue(html, ["Cut"]);
  const lab = extractLabeledValue(html, ["Certificate", "Lab"]);
  const reportNumber = extractLabeledValue(html, ["Certificate #", "Report #"]);

  return mergePartialListing(partial, {
    carat: parseCaratFromText(caratText) ?? partial.carat ?? null,
    shape: shape ?? partial.shape ?? null,
    color: color ?? partial.color ?? null,
    clarity: clarity ?? partial.clarity ?? null,
    cut: cut ?? partial.cut ?? null,
    lab: lab ?? partial.lab ?? null,
    reportNumber: reportNumber ?? partial.reportNumber ?? null,
    extractionWarnings: url.includes("jamesallen") ? [] : ["vendor_adapter_fallback"],
  });
};

const blueNileAdapter: VendorAdapter = (html) => {
  const partial = extractFromStructuredData(html);
  return mergePartialListing(partial, {
    shape: extractLabeledValue(html, ["Shape"]) ?? partial.shape ?? null,
    carat:
      parseCaratFromText(extractLabeledValue(html, ["Carat"])) ??
      partial.carat ??
      null,
    color: extractLabeledValue(html, ["Color"]) ?? partial.color ?? null,
    clarity: extractLabeledValue(html, ["Clarity"]) ?? partial.clarity ?? null,
    cut: extractLabeledValue(html, ["Cut"]) ?? partial.cut ?? null,
    lab: extractLabeledValue(html, ["Report", "Lab"]) ?? partial.lab ?? null,
  });
};

const rareCaratAdapter: VendorAdapter = (html) => {
  const partial = extractFromStructuredData(html);
  const certMatch = html.match(/certificate[^"']*["'](https?:\/\/[^"']+)["']/i);
  return mergePartialListing(partial, {
    reportUrl: certMatch?.[1] ?? partial.reportUrl ?? null,
    certificateUrl: certMatch?.[1] ?? partial.certificateUrl ?? null,
    lab: extractLabeledValue(html, ["Cert", "Lab"]) ?? partial.lab ?? null,
    reportNumber:
      extractLabeledValue(html, ["Cert #", "Report"]) ?? partial.reportNumber ?? null,
  });
};

const brilliantEarthAdapter: VendorAdapter = (html) => {
  const partial = extractFromStructuredData(html);
  return mergePartialListing(partial, {
    shape: extractLabeledValue(html, ["Shape"]) ?? partial.shape ?? null,
    carat:
      parseCaratFromText(extractLabeledValue(html, ["Carat"])) ??
      partial.carat ??
      null,
    color: extractLabeledValue(html, ["Color"]) ?? partial.color ?? null,
    clarity: extractLabeledValue(html, ["Clarity"]) ?? partial.clarity ?? null,
    cut: extractLabeledValue(html, ["Cut"]) ?? partial.cut ?? null,
    polish: extractLabeledValue(html, ["Polish"]) ?? partial.polish ?? null,
    symmetry: extractLabeledValue(html, ["Symmetry"]) ?? partial.symmetry ?? null,
    fluorescence:
      extractLabeledValue(html, ["Fluorescence"]) ?? partial.fluorescence ?? null,
  });
};

const ritaniAdapter: VendorAdapter = (html) => extractFromStructuredData(html);
const adiamorAdapter: VendorAdapter = (html) => extractFromStructuredData(html);

const VENDOR_ADAPTERS: Partial<Record<DiamondVendorId, VendorAdapter>> = {
  "james-allen": jamesAllenAdapter,
  "blue-nile": blueNileAdapter,
  "rare-carat": rareCaratAdapter,
  "brilliant-earth": brilliantEarthAdapter,
  ritani: ritaniAdapter,
  adiamor: adiamorAdapter,
};

export function extractWithVendorAdapter(
  vendor: DiamondVendorId,
  html: string,
  url: string,
): PartialListing {
  const adapter = VENDOR_ADAPTERS[vendor];
  if (adapter) return adapter(html, url);
  return extractFromStructuredData(html);
}
