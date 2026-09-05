import { BlockList, isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "127.0.0.1",
  "::1",
  "[::1]",
  "0.0.0.0",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "kubernetes.default",
  "kubernetes.default.svc",
  "kubernetes.default.svc.cluster.local",
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".localdomain",
];

const blockedDestinations = new BlockList();
blockedDestinations.addSubnet("0.0.0.0", 8, "ipv4");
blockedDestinations.addSubnet("10.0.0.0", 8, "ipv4");
blockedDestinations.addSubnet("100.64.0.0", 10, "ipv4");
blockedDestinations.addSubnet("127.0.0.0", 8, "ipv4");
blockedDestinations.addSubnet("169.254.0.0", 16, "ipv4");
blockedDestinations.addSubnet("172.16.0.0", 12, "ipv4");
blockedDestinations.addSubnet("192.168.0.0", 16, "ipv4");
blockedDestinations.addSubnet("224.0.0.0", 4, "ipv4");
blockedDestinations.addSubnet("240.0.0.0", 4, "ipv4");
blockedDestinations.addAddress("::", "ipv6");
blockedDestinations.addAddress("::1", "ipv6");
blockedDestinations.addSubnet("::1", 128, "ipv6");
blockedDestinations.addSubnet("fc00::", 7, "ipv6");
blockedDestinations.addSubnet("fe80::", 10, "ipv6");
blockedDestinations.addSubnet("ff00::", 8, "ipv6");

const GENERIC_BLOCKED_REASON = "This URL cannot be accessed.";

export type UrlSafetyResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

export type DnsLookupFn = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

let dnsLookupFn: DnsLookupFn = defaultDnsLookup;

async function defaultDnsLookup(
  hostname: string,
): Promise<Array<{ address: string; family: number }>> {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((record) => ({
    address: record.address,
    family: record.family,
  }));
}

export function setRemoteDnsLookupForTests(fn: DnsLookupFn | null): void {
  dnsLookupFn = fn ?? defaultDnsLookup;
}

function normalizeHostname(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/, "");
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (BLOCKED_HOSTNAMES.has(normalized) || BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    return true;
  }
  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function unwrapMappedIpv4(address: string): string | null {
  const lower = address.toLowerCase();
  if (!lower.startsWith("::ffff:")) return null;
  const rest = lower.slice(7);
  if (isIP(rest) === 4) return rest;
  const hex = rest.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return null;
  const hi = Number.parseInt(hex[1], 16);
  const lo = Number.parseInt(hex[2], 16);
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null;
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

export function isBlockedIpAddress(address: string): boolean {
  const mapped = unwrapMappedIpv4(address);
  if (mapped) return isBlockedIpAddress(mapped);

  const family = isIP(address);
  if (family === 4) return blockedDestinations.check(address, "ipv4");
  if (family === 6) return blockedDestinations.check(address, "ipv6");
  return true;
}

function validateParsedUrl(parsed: URL): UrlSafetyResult {
  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      reason: "Only https listing URLs are supported.",
    };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: "URLs with embedded credentials are not allowed." };
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname || isBlockedHostname(parsed.hostname)) {
    return { ok: false, reason: GENERIC_BLOCKED_REASON };
  }

  const ipFamily = isIP(hostname);
  if (ipFamily !== 0 && isBlockedIpAddress(hostname)) {
    return { ok: false, reason: GENERIC_BLOCKED_REASON };
  }

  return { ok: true, url: parsed };
}

export function validateListingUrl(input: string): UrlSafetyResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, reason: "A listing URL is required." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Please enter a valid diamond listing URL." };
  }

  return validateParsedUrl(parsed);
}

/**
 * Re-parse and validate a redirect Location before fetching it.
 * Protocol downgrades are rejected by the https-only rule.
 */
export function validateRedirectTarget(
  location: string,
  currentUrl: string,
): UrlSafetyResult {
  let next: URL;
  try {
    next = new URL(location, currentUrl);
  } catch {
    return { ok: false, reason: GENERIC_BLOCKED_REASON };
  }
  return validateParsedUrl(next);
}

/**
 * Resolve hostname A/AAAA records and reject private/metadata destinations.
 *
 * Limitation: Node `fetch()` cannot pin the connected IP. A DNS rebinding
 * race between this lookup and the subsequent TCP connect remains possible.
 */
export async function resolveAndValidateRemoteUrl(
  input: string,
): Promise<UrlSafetyResult> {
  const parsed = validateListingUrl(input);
  if (!parsed.ok) return parsed;

  const hostname = normalizeHostname(parsed.url.hostname);
  if (isIP(hostname) !== 0) {
    return parsed;
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await dnsLookupFn(hostname);
  } catch {
    return { ok: false, reason: GENERIC_BLOCKED_REASON };
  }

  if (!records.length) {
    return { ok: false, reason: GENERIC_BLOCKED_REASON };
  }

  for (const record of records) {
    if (isBlockedIpAddress(record.address)) {
      return { ok: false, reason: GENERIC_BLOCKED_REASON };
    }
  }

  return parsed;
}

export function isPdfOrReportUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    return (
      path.endsWith(".pdf") ||
      path.includes("/pdf/") ||
      path.includes("certificate") ||
      path.includes("report")
    );
  } catch {
    return false;
  }
}
