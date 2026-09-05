/**
 * Server-only exact project Gmail thread fetch.
 * Authority is continuum_project_history.gmail_thread_id after existing
 * coerceGmailThreadId validation. No subject/Person/CAD/order/body
 * discovery. Returns in-memory evidence only — no canonical writes.
 */

import { coerceGmailThreadId } from "@/lib/continuum/client-memory/gmail";
import { GmailHttpError, type GmailApi } from "./adapter";
import type { GmailConnectionStore } from "./connection";
import { protectExactThread, type ProtectedExactThread } from "./exact-thread-payload";
import type { GmailAccessTokenRefresh } from "./oauth";
import {
  buildExactThreadReconstructionHandoff,
  type ExactThreadCurrentSpecs,
  type ExactThreadReconstructionHandoff,
} from "./reconstruction-evidence";
import type { GmailConnection, GmailTokenCiphertext } from "./types";

export const EXACT_PROJECT_THREAD_FETCH_ERROR_CODES = [
  "unauthorized",
  "unavailable",
  "project-not-found",
  "blank-pointer",
  "invalid-pointer",
  "gmail-not-connected",
  "decrypt-failed",
  "token-refresh-failed",
  "refresh-token-rotated",
  "oauth-not-configured",
  "thread-not-found",
  "thread-inaccessible",
  "thread-fetch-failed",
] as const;

export type ExactProjectThreadFetchErrorCode =
  (typeof EXACT_PROJECT_THREAD_FETCH_ERROR_CODES)[number];

export const EXACT_PROJECT_THREAD_FETCH_FAILURE_KEYS = ["ok", "safeErrorCode"] as const;

export type ExactProjectThreadPointer = {
  projectId: string;
  gmailThreadId: string | null;
  fingerSize: string | null;
  orderNumber: string | null;
  cadJobNumber: string | null;
  metal: string | null;
  centerStone: string | null;
};

export type ExactProjectThreadLookup = {
  getByProjectId(projectId: string): Promise<ExactProjectThreadPointer | null>;
};

export type ExactProjectThreadFetchInput = {
  founderSessionOk: boolean;
  projectId: string;
  projects: ExactProjectThreadLookup;
  connections: GmailConnectionStore;
  decryptRefreshToken: (wrapped: GmailTokenCiphertext) => string;
  refreshAccessToken: (refreshToken: string) => Promise<GmailAccessTokenRefresh>;
  createApi: (accessToken: string) => GmailApi;
};

export type ExactProjectThreadFetchFailure = {
  ok: false;
  safeErrorCode: ExactProjectThreadFetchErrorCode;
};

export type ExactProjectThreadFetchSuccess = {
  ok: true;
  safeErrorCode: null;
  reconstruction: ExactThreadReconstructionHandoff;
};

export type ExactProjectThreadFetchResult =
  | ExactProjectThreadFetchFailure
  | ExactProjectThreadFetchSuccess;

function isFetchErrorCode(
  value: string | null,
): value is ExactProjectThreadFetchErrorCode {
  return (
    typeof value === "string" &&
    (EXACT_PROJECT_THREAD_FETCH_ERROR_CODES as readonly string[]).includes(value)
  );
}

export function failedExactProjectThreadFetch(
  code: ExactProjectThreadFetchErrorCode,
): ExactProjectThreadFetchFailure {
  return { ok: false, safeErrorCode: code };
}

export function sanitizeExactProjectThreadFetchFailure(
  raw: ExactProjectThreadFetchFailure,
): ExactProjectThreadFetchFailure {
  const code = isFetchErrorCode(raw.safeErrorCode)
    ? raw.safeErrorCode
    : "thread-fetch-failed";
  return { ok: false, safeErrorCode: code };
}

export function exactProjectThreadFetchFailureKeys(
  result: ExactProjectThreadFetchFailure,
): string[] {
  return Object.keys(result).sort();
}

export function specsFromPointer(
  pointer: ExactProjectThreadPointer,
): ExactThreadCurrentSpecs {
  return {
    fingerSize: pointer.fingerSize,
    orderNumber: pointer.orderNumber,
    cadJobNumber: pointer.cadJobNumber,
    metal: pointer.metal,
    centerStone: pointer.centerStone,
  };
}

export function lookupFromGetProjectHistory(
  getProjectHistory: (
    projectId: string,
  ) => Promise<ExactProjectThreadPointer | null>,
): ExactProjectThreadLookup {
  return {
    getByProjectId: (projectId) => getProjectHistory(projectId),
  };
}

function isConnectedCredential(
  row: GmailConnection | null,
): row is GmailConnection & { refreshToken: GmailTokenCiphertext } {
  return Boolean(row && row.status === "connected" && row.refreshToken);
}

export function exactThreadOnlyApi(api: GmailApi): GmailApi {
  return {
    getProfile: async () => {
      throw new Error("users.getProfile-forbidden-on-exact-thread-path");
    },
    listMessages: async () => {
      throw new Error("messages.list-forbidden-on-exact-thread-path");
    },
    getMessage: async () => {
      throw new Error("messages.get-forbidden-on-exact-thread-path");
    },
    listHistory: async () => {
      throw new Error("history.list-forbidden-on-exact-thread-path");
    },
    getThread: (threadId) => api.getThread(threadId),
  };
}

function threadFetchErrorCode(error: unknown): ExactProjectThreadFetchErrorCode {
  if (error instanceof GmailHttpError) {
    if (error.status === 404) return "thread-not-found";
    if (error.status === 403) return "thread-inaccessible";
  }
  if (error instanceof Error && error.message === "gmail-thread-missing") {
    return "thread-not-found";
  }
  return "thread-fetch-failed";
}

function successFromProtectedThread(
  pointer: ExactProjectThreadPointer,
  thread: ProtectedExactThread,
): ExactProjectThreadFetchSuccess {
  return {
    ok: true,
    safeErrorCode: null,
    reconstruction: buildExactThreadReconstructionHandoff({
      projectId: pointer.projectId,
      currentSpecs: specsFromPointer(pointer),
      thread,
    }),
  };
}

export async function runExactProjectThreadFetch(
  input: ExactProjectThreadFetchInput,
): Promise<ExactProjectThreadFetchResult> {
  if (!input.founderSessionOk) {
    return failedExactProjectThreadFetch("unauthorized");
  }

  const projectId = input.projectId.trim();
  if (!projectId) {
    return failedExactProjectThreadFetch("project-not-found");
  }

  let pointer: ExactProjectThreadPointer | null;
  try {
    pointer = await input.projects.getByProjectId(projectId);
  } catch {
    return failedExactProjectThreadFetch("unavailable");
  }
  if (!pointer || pointer.projectId !== projectId) {
    return failedExactProjectThreadFetch("project-not-found");
  }

  const coerced = coerceGmailThreadId(pointer.gmailThreadId);
  if (coerced.status === "blank") {
    return failedExactProjectThreadFetch("blank-pointer");
  }
  if (coerced.status !== "canonical") {
    return failedExactProjectThreadFetch("invalid-pointer");
  }
  const exactThreadId = coerced.value;

  let connection: GmailConnection | null;
  try {
    connection = await input.connections.getFounderConnection();
  } catch {
    return failedExactProjectThreadFetch("unavailable");
  }
  if (!isConnectedCredential(connection)) {
    return failedExactProjectThreadFetch("gmail-not-connected");
  }

  let refreshToken: string;
  try {
    refreshToken = input.decryptRefreshToken(connection.refreshToken);
    if (!refreshToken) {
      return failedExactProjectThreadFetch("decrypt-failed");
    }
  } catch {
    return failedExactProjectThreadFetch("decrypt-failed");
  }

  let refreshed: GmailAccessTokenRefresh;
  try {
    refreshed = await input.refreshAccessToken(refreshToken);
  } catch {
    return failedExactProjectThreadFetch("token-refresh-failed");
  }
  if (!refreshed.ok) {
    return failedExactProjectThreadFetch(refreshed.error);
  }

  const api = exactThreadOnlyApi(input.createApi(refreshed.accessToken));
  try {
    const raw = await api.getThread(exactThreadId);
    if (!raw?.id || raw.id !== exactThreadId) {
      return failedExactProjectThreadFetch("thread-fetch-failed");
    }
    return successFromProtectedThread(pointer, protectExactThread(raw));
  } catch (error) {
    return failedExactProjectThreadFetch(threadFetchErrorCode(error));
  }
}
