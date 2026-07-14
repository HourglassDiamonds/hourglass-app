/**
 * Server-only HubSpot helpers for Concierge submissions.
 * Never import from client components.
 */

export const HUBSPOT_BASE_URL = "https://api.hubapi.com";
export const HUBSPOT_TIMEOUT_MS = 12_000;

/** Primary + alias private-app token names used in Vercel / .env.example. */
export const HUBSPOT_TOKEN_ENV_NAMES = [
  "HUBSPOT_ACCESS_TOKEN",
  "HUBSPOT_PRIVATE_APP_TOKEN",
] as const;

export type HubSpotTokenSource =
  | (typeof HUBSPOT_TOKEN_ENV_NAMES)[number]
  | null;

export function resolveHubSpotToken(env: NodeJS.ProcessEnv = process.env): {
  token: string | null;
  source: HubSpotTokenSource;
} {
  for (const name of HUBSPOT_TOKEN_ENV_NAMES) {
    const value = env[name]?.trim();
    if (value) {
      return { token: value, source: name };
    }
  }
  return { token: null, source: null };
}

/** Strip secrets / PII before logging HubSpot error bodies. */
export function sanitizeHubSpotErrorBody(text: string, max = 400): string {
  return text
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      "[redacted-email]",
    )
    .replace(/pat-[a-zA-Z0-9-]+/gi, "[redacted-token]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export class HubSpotRequestError extends Error {
  readonly status: number;
  readonly path: string;
  readonly hubspotMessage: string;

  constructor(status: number, path: string, hubspotMessage: string) {
    super("hubspot_request_failed");
    this.name = "HubSpotRequestError";
    this.status = status;
    this.path = path;
    this.hubspotMessage = hubspotMessage;
  }
}

export class HubSpotConfigError extends Error {
  constructor() {
    super("missing_server_configuration");
    this.name = "HubSpotConfigError";
  }
}

export type HubSpotFetchOptions = {
  treatNotFoundAsEmpty?: boolean;
  token?: string;
  fetchImpl?: typeof fetch;
};

export async function hubspotFetchJson<T>(
  path: string,
  init: RequestInit,
  options: HubSpotFetchOptions = {},
): Promise<T | null> {
  const resolved = options.token ?? resolveHubSpotToken().token;
  if (!resolved) {
    throw new HubSpotConfigError();
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HUBSPOT_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${HUBSPOT_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${resolved}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 404 && options.treatNotFoundAsEmpty) {
      return null;
    }

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      const hubspotMessage = sanitizeHubSpotErrorBody(raw);
      console.error("[concierge-hubspot]", {
        path,
        status: response.status,
        message: hubspotMessage || undefined,
      });
      throw new HubSpotRequestError(response.status, path, hubspotMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (
      error instanceof HubSpotRequestError ||
      error instanceof HubSpotConfigError
    ) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[concierge-hubspot-timeout]", { path });
      throw new Error("hubspot_timeout");
    }
    console.error("[concierge-hubspot-network]", {
      path,
      error: error instanceof Error ? error.name : "unknown",
    });
    throw new Error("hubspot_network_error");
  } finally {
    clearTimeout(timeout);
  }
}
