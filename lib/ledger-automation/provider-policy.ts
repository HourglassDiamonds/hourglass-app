type ProviderSourceReference = {
  institution?: string;
  sourceAuthority?: string;
  title?: string;
  sourceName?: string;
  url?: string;
  sourceUrl?: string;
  sourceLocation?: string;
};

const ICE_SERIES_PATTERN = /\bBAML[A-Z0-9]+\b/i;
const ICE_NAME_PATTERN = /\b(?:ICE\s+BofA|St\.\s*Louis\s+Fed\s*\/\s*ICE)\b/i;

/**
 * ICE/BofA index observations available through FRED are not approved for the
 * Ledger's active registry or public current-state surfaces. Historical frozen
 * publication prose is left intact, but it cannot be carried into a new
 * publication or rendered as a current source.
 */
export function isRestrictedIceSource(source: ProviderSourceReference): boolean {
  const text = [
    source.institution,
    source.sourceAuthority,
    source.title,
    source.sourceName,
    source.url,
    source.sourceUrl,
    source.sourceLocation,
  ].filter(Boolean).join(" ");
  return ICE_SERIES_PATTERN.test(text) || ICE_NAME_PATTERN.test(text);
}

export function permittedLedgerSources<T extends ProviderSourceReference>(
  sources: readonly T[],
): T[] {
  return sources.filter((source) => !isRestrictedIceSource(source));
}
