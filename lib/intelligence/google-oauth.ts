import { OAuth2Client } from "google-auth-library";

export type Ga4OAuthErrorCode =
  | "MISSING_ENV"
  | "INVALID_REFRESH_TOKEN"
  | "TOKEN_REFRESH_FAILED"
  | "GA4_API_FAILED";

export class Ga4OAuthError extends Error {
  readonly code: Ga4OAuthErrorCode;

  constructor(message: string, code: Ga4OAuthErrorCode, cause?: unknown) {
    super(message);
    this.name = "Ga4OAuthError";
    this.code = code;
    if (cause instanceof Error && cause.stack) {
      this.cause = cause;
    }
  }
}

export type Ga4OAuthEnv = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  propertyId: string;
  redirectUri: string;
};

const ANALYTICS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/analytics.readonly";

let authClient: OAuth2Client | null = null;
let oauthConnectedLogged = false;

function optional(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

export function getGa4OAuthEnv(): Ga4OAuthEnv | null {
  const clientId = optional("GOOGLE_CLIENT_ID");
  const clientSecret = optional("GOOGLE_CLIENT_SECRET");
  const refreshToken = optional("GOOGLE_REFRESH_TOKEN");
  const propertyId = optional("GA4_PROPERTY_ID");

  if (!clientId || !clientSecret || !refreshToken || !propertyId) {
    return null;
  }

  const redirectUri =
    optional("GOOGLE_OAUTH_REDIRECT_URI") ??
    "http://localhost:3000/api/intelligence/google-oauth-callback";

  return {
    clientId,
    clientSecret,
    refreshToken,
    propertyId,
    redirectUri,
  };
}

export function isGa4OAuthConfigured(): boolean {
  return getGa4OAuthEnv() !== null;
}

export function getOAuthRedirectUri(): string {
  return (
    getGa4OAuthEnv()?.redirectUri ??
    "http://localhost:3000/api/intelligence/google-oauth-callback"
  );
}

function getOAuthClientCredentials(): Pick<
  Ga4OAuthEnv,
  "clientId" | "clientSecret" | "redirectUri"
> | null {
  const clientId = optional("GOOGLE_CLIENT_ID");
  const clientSecret = optional("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri:
      optional("GOOGLE_OAUTH_REDIRECT_URI") ??
      "http://localhost:3000/api/intelligence/google-oauth-callback",
  };
}

/** Build Google consent URL (one-time setup to obtain refresh token). */
export function buildGoogleAuthUrl(): string {
  const creds = getOAuthClientCredentials();
  if (!creds) {
    throw new Ga4OAuthError(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required to build the auth URL",
      "MISSING_ENV",
    );
  }

  const client = new OAuth2Client(
    creds.clientId,
    creds.clientSecret,
    creds.redirectUri,
  );
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [ANALYTICS_READONLY_SCOPE],
  });
}

/** Exchange authorization code for tokens (setup flow only). */
export async function exchangeCodeForTokens(code: string): Promise<{
  refreshToken: string | null;
  accessToken: string | null;
}> {
  const creds = getOAuthClientCredentials();
  if (!creds) {
    throw new Ga4OAuthError(
      "OAuth client env missing — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
      "MISSING_ENV",
    );
  }

  const client = new OAuth2Client(
    creds.clientId,
    creds.clientSecret,
    creds.redirectUri,
  );
  try {
    const { tokens } = await client.getToken(code);
    return {
      refreshToken: tokens.refresh_token ?? null,
      accessToken: tokens.access_token ?? null,
    };
  } catch (err) {
    throw new Ga4OAuthError(
      "Failed to exchange authorization code — check redirect URI matches Google Cloud OAuth client",
      "TOKEN_REFRESH_FAILED",
      err,
    );
  }
}

function mapTokenError(err: unknown): Ga4OAuthError {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (
    lower.includes("invalid_grant") ||
    lower.includes("invalid refresh token") ||
    lower.includes("token has been expired or revoked")
  ) {
    return new Ga4OAuthError(
      "Google refresh token is invalid or revoked — re-run OAuth setup and update GOOGLE_REFRESH_TOKEN",
      "INVALID_REFRESH_TOKEN",
      err,
    );
  }

  return new Ga4OAuthError(
    `Failed to refresh Google access token: ${message}`,
    "TOKEN_REFRESH_FAILED",
    err,
  );
}

/** OAuth2 client with refresh token — used by GA4 Data API client. */
export async function getGa4AuthClient(): Promise<OAuth2Client> {
  const env = getGa4OAuthEnv();
  if (!env) {
    throw new Ga4OAuthError(
      "GA4 OAuth not configured — set GA4_PROPERTY_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN",
      "MISSING_ENV",
    );
  }

  if (!authClient) {
    authClient = new OAuth2Client(env.clientId, env.clientSecret, env.redirectUri);
    authClient.setCredentials({ refresh_token: env.refreshToken });
  }

  try {
    const tokenResponse = await authClient.getAccessToken();
    const token =
      typeof tokenResponse === "string"
        ? tokenResponse
        : tokenResponse?.token;

    if (!token) {
      throw new Ga4OAuthError(
        "No access token returned — refresh token may be invalid",
        "INVALID_REFRESH_TOKEN",
      );
    }

    if (!oauthConnectedLogged) {
      console.log("[hourglass:intelligence] GA4 OAuth connected");
      oauthConnectedLogged = true;
    }
  } catch (err) {
    if (err instanceof Ga4OAuthError) throw err;
    throw mapTokenError(err);
  }

  return authClient;
}

export function ga4PropertyResourceName(): string {
  const env = getGa4OAuthEnv();
  if (!env) {
    throw new Ga4OAuthError("GA4_PROPERTY_ID is required", "MISSING_ENV");
  }
  return `properties/${env.propertyId}`;
}

export function mapGa4ApiError(err: unknown): Ga4OAuthError {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes("permission_denied") || lower.includes("403")) {
    return new Ga4OAuthError(
      "GA4 API permission denied — ensure the Google user has access to this GA4 property",
      "GA4_API_FAILED",
      err,
    );
  }

  if (lower.includes("invalid_argument") || lower.includes("not found")) {
    return new Ga4OAuthError(
      "GA4 API request failed — verify GA4_PROPERTY_ID is the numeric property ID",
      "GA4_API_FAILED",
      err,
    );
  }

  return new Ga4OAuthError(`GA4 Data API request failed: ${message}`, "GA4_API_FAILED", err);
}
