/**
 * Founder-only zero-write Gmail connection probe.
 * Decrypts the existing founder-v1 refresh token in process memory, refreshes
 * an access token, calls users.getProfile() + messages.list only, and returns
 * a sanitized diagnostic. Never indexes, checkpoints, or mutates connections.
 */

import type { GmailApi } from "./adapter";
import type { GmailConnectionStore } from "./connection";
import { bindFounderMailbox } from "./mailbox";
import type { GmailAccessTokenRefresh } from "./oauth";
import {
  CONCIERGE_GMAIL_PATH,
  type GmailConnection,
  type GmailTokenCiphertext,
} from "./types";

export { CONCIERGE_GMAIL_PATH };
export const GMAIL_CONNECTION_TEST_QUERY =
  "(in:inbox OR in:sent) newer_than:7d";
export const GMAIL_CONNECTION_TEST_MAX_RESULTS = 5;

export const GMAIL_CONNECTION_TEST_ERROR_CODES = [
  "unauthorized",
  "unavailable",
  "gmail-not-connected",
  "decrypt-failed",
  "token-refresh-failed",
  "refresh-token-rotated",
  "gmail-wrong-mailbox",
  "gmail-mailbox-unconfigured",
  "profile-failed",
  "list-failed",
  "oauth-not-configured",
  "gmail-connection-test-write-forbidden",
] as const;

export type GmailConnectionTestErrorCode =
  (typeof GMAIL_CONNECTION_TEST_ERROR_CODES)[number];

export type GmailConnectionTestResult = {
  connectionVerified: boolean;
  mailboxVerified: boolean;
  querySucceeded: boolean;
  resultSizeEstimate: number | null;
  returnedIdCount: number;
  labelsAvailableFromListResponse: boolean;
  safeErrorCode: string | null;
};

const RESULT_KEYS = [
  "connectionVerified",
  "mailboxVerified",
  "querySucceeded",
  "resultSizeEstimate",
  "returnedIdCount",
  "labelsAvailableFromListResponse",
  "safeErrorCode",
] as const;

export type GmailConnectionTestInput = {
  founderSessionOk: boolean;
  connections: GmailConnectionStore;
  decryptRefreshToken: (wrapped: GmailTokenCiphertext) => string;
  refreshAccessToken: (refreshToken: string) => Promise<GmailAccessTokenRefresh>;
  createApi: (accessToken: string) => GmailApi;
  founderEmail?: string;
};

export function failedGmailConnectionTest(
  code: GmailConnectionTestErrorCode,
): GmailConnectionTestResult {
  return sanitizeGmailConnectionTestResult({
    connectionVerified: false,
    mailboxVerified: false,
    querySucceeded: false,
    resultSizeEstimate: null,
    returnedIdCount: 0,
    labelsAvailableFromListResponse: false,
    safeErrorCode: code,
  });
}

export function sanitizeGmailConnectionTestResult(
  raw: GmailConnectionTestResult,
): GmailConnectionTestResult {
  const estimate =
    typeof raw.resultSizeEstimate === "number" &&
    Number.isFinite(raw.resultSizeEstimate)
      ? raw.resultSizeEstimate
      : null;
  const returnedIdCount = clampReturnedIdCount(raw.returnedIdCount);
  const safeErrorCode =
    typeof raw.safeErrorCode === "string" && raw.safeErrorCode
      ? raw.safeErrorCode
      : null;
  return {
    connectionVerified: Boolean(raw.connectionVerified),
    mailboxVerified: Boolean(raw.mailboxVerified),
    querySucceeded: Boolean(raw.querySucceeded),
    resultSizeEstimate: estimate,
    returnedIdCount,
    labelsAvailableFromListResponse: Boolean(
      raw.labelsAvailableFromListResponse,
    ),
    safeErrorCode,
  };
}

function clampReturnedIdCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(GMAIL_CONNECTION_TEST_MAX_RESULTS, Math.trunc(value)));
}

export function readOnlyGmailConnectionStore(
  store: GmailConnectionStore,
): GmailConnectionStore {
  return {
    getFounderConnection: () => store.getFounderConnection(),
    putConnection: async () => {
      throw new Error("gmail-connection-test-write-forbidden");
    },
  };
}

function isConnectedCredential(
  row: GmailConnection | null,
): row is GmailConnection & { refreshToken: GmailTokenCiphertext } {
  return Boolean(row && row.status === "connected" && row.refreshToken);
}

function labelsAvailableFromList(
  messages: readonly { labelIds?: readonly string[] }[],
): boolean {
  return messages.some(
    (row) => Array.isArray(row.labelIds) && row.labelIds.length > 0,
  );
}

export async function runGmailConnectionTest(
  input: GmailConnectionTestInput,
): Promise<GmailConnectionTestResult> {
  if (!input.founderSessionOk) {
    return failedGmailConnectionTest("unauthorized");
  }

  let connection: GmailConnection | null;
  try {
    connection = await input.connections.getFounderConnection();
  } catch {
    return failedGmailConnectionTest("unavailable");
  }

  if (!isConnectedCredential(connection)) {
    return failedGmailConnectionTest("gmail-not-connected");
  }

  let refreshToken: string;
  try {
    refreshToken = input.decryptRefreshToken(connection.refreshToken);
    if (!refreshToken) {
      return failedGmailConnectionTest("decrypt-failed");
    }
  } catch {
    return failedGmailConnectionTest("decrypt-failed");
  }

  let refreshed: GmailAccessTokenRefresh;
  try {
    refreshed = await input.refreshAccessToken(refreshToken);
  } catch {
    return failedGmailConnectionTest("token-refresh-failed");
  }
  if (!refreshed.ok) {
    return failedGmailConnectionTest(refreshed.error);
  }

  const api = input.createApi(refreshed.accessToken);

  let profileEmail: string;
  try {
    const profile = await api.getProfile();
    profileEmail = profile.emailAddress;
  } catch {
    return failedGmailConnectionTest("profile-failed");
  }

  const bound = bindFounderMailbox(profileEmail, input.founderEmail);
  if (!bound.ok) {
    return sanitizeGmailConnectionTestResult({
      connectionVerified: true,
      mailboxVerified: false,
      querySucceeded: false,
      resultSizeEstimate: null,
      returnedIdCount: 0,
      labelsAvailableFromListResponse: false,
      safeErrorCode: bound.error,
    });
  }

  try {
    const page = await api.listMessages({
      q: GMAIL_CONNECTION_TEST_QUERY,
      maxResults: GMAIL_CONNECTION_TEST_MAX_RESULTS,
    });
    const messages = page.messages ?? [];
    return sanitizeGmailConnectionTestResult({
      connectionVerified: true,
      mailboxVerified: true,
      querySucceeded: true,
      resultSizeEstimate:
        typeof page.resultSizeEstimate === "number"
          ? page.resultSizeEstimate
          : null,
      returnedIdCount: messages.length,
      labelsAvailableFromListResponse: labelsAvailableFromList(messages),
      safeErrorCode: null,
    });
  } catch {
    return sanitizeGmailConnectionTestResult({
      connectionVerified: true,
      mailboxVerified: true,
      querySucceeded: false,
      resultSizeEstimate: null,
      returnedIdCount: 0,
      labelsAvailableFromListResponse: false,
      safeErrorCode: "list-failed",
    });
  }
}

export function gmailConnectionTestResultKeys(
  result: GmailConnectionTestResult,
): string[] {
  return Object.keys(result).sort();
}

export const GMAIL_CONNECTION_TEST_RESULT_KEYS = [...RESULT_KEYS].sort();
