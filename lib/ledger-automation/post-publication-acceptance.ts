import { SITE_URL } from "@/lib/seo/site-metadata";
import type { LedgerPublication } from "./publication-types";

export const LEDGER_PUBLIC_ROUTES = [
  "/ledger",
  "/ledger/global-pressure-index",
  "/ledger/ai-capability-acceleration-index",
  "/ledger/precious-materials-index",
  "/ledger/infrastructure-strain-index",
  "/ledger/global-water-stress",
  "/ledger/information-signal-map",
  "/ledger/buffer-health",
] as const;

export type AcceptanceResult = {
  ok: boolean;
  checkedAt: string;
  failures: readonly string[];
};

function routeExpectations(path: string, publication: LedgerPublication): readonly string[] {
  if (path === "/ledger") {
    return [
      publication.publicationDate,
      `${publication.overall.temperature}`,
      publication.overall.qualitativeState,
      publication.overall.systemicDirection,
      publication.bufferHealth.state,
      ...publication.monitors.flatMap((monitor) => [monitor.hubState, monitor.hubDirection]),
    ];
  }
  if (path === "/ledger/buffer-health") {
    return [publication.publicationDate, publication.bufferHealth.state, publication.bufferHealth.direction, ...publication.bufferHealth.domains.map((domain) => domain.state)];
  }
  const idByPath: Readonly<Record<string, LedgerPublication["monitors"][number]["id"]>> = {
    "/ledger/global-pressure-index": "global-pressure",
    "/ledger/ai-capability-acceleration-index": "ai-capability",
    "/ledger/precious-materials-index": "precious-materials",
    "/ledger/infrastructure-strain-index": "infrastructure-strain",
    "/ledger/global-water-stress": "global-water-stress",
    "/ledger/information-signal-map": "information-signal",
  };
  const monitor = publication.monitors.find((item) => item.id === idByPath[path]);
  return monitor ? [publication.publicationDate, monitor.state, monitor.direction] : [];
}

export async function validatePublishedLedger(
  publication: LedgerPublication,
  options: { origin?: string; fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<AcceptanceResult> {
  const origin = (options.origin ?? SITE_URL).replace(/\/$/, "");
  const fetcher = options.fetcher ?? fetch;
  const failures: string[] = [];
  const paths = [...LEDGER_PUBLIC_ROUTES, "/sitemap.xml", "/robots.txt"];

  await Promise.all(paths.map(async (path) => {
    let response: Response;
    try {
      response = await fetcher(`${origin}${path}`, {
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
      });
    } catch (error) {
      failures.push(`${path}: request failed (${error instanceof Error ? error.message : "unknown error"})`);
      return;
    }
    if (response.status !== 200) {
      failures.push(`${path}: expected HTTP 200, received ${response.status}`);
      return;
    }
    if (!path.startsWith("/ledger")) return;
    const html = await response.text();
    if (!html.includes(`data-ledger-publication-id="${publication.publicationId}"`)) failures.push(`${path}: current publication marker is stale`);
    if (!html.includes(`data-ledger-publication-date="${publication.publicationDate}"`)) failures.push(`${path}: current publication date marker is stale`);
    for (const expected of routeExpectations(path, publication)) {
      if (!html.includes(expected)) failures.push(`${path}: missing expected publication value ${JSON.stringify(expected)}`);
    }
    if (!html.includes(`rel="canonical"`) || !html.includes(`${origin}${path}`)) failures.push(`${path}: canonical URL missing or stale`);
    if (/name="robots"[^>]*content="[^"]*noindex/i.test(html)) failures.push(`${path}: accidental noindex`);
  }));

  return { ok: failures.length === 0, checkedAt: new Date().toISOString(), failures };
}
