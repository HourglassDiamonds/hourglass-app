const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
];

function isPrivateIpv4(host: string): boolean {
  return PRIVATE_IPV4_RANGES.some((re) => re.test(host));
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80")
  );
}

export type UrlSafetyResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

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

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      ok: false,
      reason: "Only http and https listing URLs are supported.",
    };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: "URLs with embedded credentials are not allowed." };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { ok: false, reason: "This URL cannot be accessed." };
  }

  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    return { ok: false, reason: "This URL cannot be accessed." };
  }

  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return { ok: false, reason: "This URL cannot be accessed." };
  }

  return { ok: true, url: parsed };
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
