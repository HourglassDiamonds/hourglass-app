export const AUTHORITY_STATUSES = [
  "live",
  "submitted",
  "incomplete",
  "unknown",
  "not-started",
  "not-worth-pursuing",
] as const;

export type AuthorityStatus = (typeof AUTHORITY_STATUSES)[number];
export type AuthorityRegisterEntry = {
  sourceId: CorroborationSourceId;
  authority: string;
  status: AuthorityStatus;
  previousStatus?: AuthorityStatus | null;
  lastChecked: string | null;
  evidence: string | null;
  nextAction: string | null;
  owner: string | null;
  url: string | null;
};

export const CORROBORATION_SOURCE_IDS = [
  "google-business-profile",
  "bing-places",
  "apple-business-connect",
  "bing-webmaster-tools",
  "jewelers-of-america",
  "zola",
  "carats-and-cake",
  "jbt",
  "verified-same-as",
  "local-falcon",
] as const;

export type CorroborationSourceId = (typeof CORROBORATION_SOURCE_IDS)[number];

export const CORROBORATION_LABELS: Record<CorroborationSourceId, string> = {
  "google-business-profile": "Google Business Profile",
  "bing-places": "Bing Places",
  "apple-business-connect": "Apple Business Connect",
  "bing-webmaster-tools": "Bing Webmaster Tools",
  "jewelers-of-america": "Jewelers of America",
  zola: "Zola",
  "carats-and-cake": "Carats + Cake",
  jbt: "JBT",
  "verified-same-as": "Verified sameAs / social profiles",
  "local-falcon": "Local Falcon",
};

const NEXT_ACTIONS: Record<CorroborationSourceId, string> = {
  "google-business-profile": "Confirm Google Place ID and review sync.",
  "bing-places": "Verify the Bing Places listing.",
  "apple-business-connect": "Confirm Apple Business Connect ownership.",
  "bing-webmaster-tools": "Review sitemap and verification status.",
  "jewelers-of-america": "Verify the current JA listing.",
  zola: "Verify the Hourglass Zola profile.",
  "carats-and-cake": "Verify the Carats + Cake profile.",
  jbt: "Verify the current JBT listing.",
  "verified-same-as": "Confirm each real sameAs URL.",
  "local-falcon": "Import a current Local Falcon competitor report.",
};

/** Conservative repository-backed state only; this register performs no network checks. */
export const EXTERNAL_AUTHORITY_REGISTER: readonly AuthorityRegisterEntry[] = [
  ...CORROBORATION_SOURCE_IDS.map((sourceId) => ({
    sourceId,
    authority: CORROBORATION_LABELS[sourceId],
    status: sourceId === "google-business-profile"
      ? "incomplete" as const
      : sourceId === "local-falcon"
        ? "not-started" as const
        : "unknown" as const,
    lastChecked: null,
    evidence: sourceId === "google-business-profile"
      ? "OAuth infrastructure exists; review scope and managed location are not yet confirmed."
      : sourceId === "local-falcon"
        ? "No canonical imported competitor snapshot evidence is stored yet."
        : "No verified repository evidence.",
    nextAction: NEXT_ACTIONS[sourceId],
    owner: null,
    url: null,
  })),
] as const;

export function defaultAuthorityRegister(): AuthorityRegisterEntry[] {
  return EXTERNAL_AUTHORITY_REGISTER.map((entry) => ({ ...entry }));
}
