/**
 * Server-only Gmail API abstraction.
 * Mockable. Live fetch exists but must not be invoked from this activation task.
 * Never fetch attachment bytes from Gmail.
 */

import type {
  GmailApiMessage,
  GmailApiThread,
  GmailListPage,
  GmailProfile,
} from "./types";

export type GmailListMessagesQuery = {
  q: string;
  pageToken?: string | null;
  maxResults?: number;
};

export type GmailApi = {
  getProfile(): Promise<GmailProfile>;
  listMessages(query: GmailListMessagesQuery): Promise<GmailListPage>;
  getMessage(messageId: string): Promise<GmailApiMessage>;
  getThread(threadId: string): Promise<GmailApiThread>;
};

export type GmailApiCall =
  | { method: "getProfile" }
  | { method: "listMessages"; q: string; pageToken: string | null }
  | { method: "getMessage"; messageId: string }
  | { method: "getThread"; threadId: string };

export class MockGmailApi implements GmailApi {
  readonly calls: GmailApiCall[] = [];
  private readonly profiles: GmailProfile[] = [];
  private readonly pages = new Map<string, GmailListPage>();
  private readonly messages = new Map<string, GmailApiMessage>();
  private readonly threads = new Map<string, GmailApiThread>();
  private defaultPage: GmailListPage = { messages: [], nextPageToken: null };
  errors = new Map<string, Error>();
  statusErrors: Array<{ status: number; reason?: string; retryAfter?: string }> =
    [];

  setProfile(profile: GmailProfile): void {
    this.profiles.splice(0, this.profiles.length, profile);
  }

  setListPage(pageToken: string | null, page: GmailListPage): void {
    this.pages.set(pageToken ?? "", page);
    if (!pageToken) this.defaultPage = page;
  }

  setMessage(message: GmailApiMessage): void {
    this.messages.set(message.id, message);
  }

  setThread(thread: GmailApiThread): void {
    this.threads.set(thread.id, thread);
  }

  private maybeThrow(key: string): void {
    const queued = this.statusErrors.shift();
    if (queued) {
      const error = new GmailHttpError(
        queued.status,
        queued.reason ?? "rateLimitExceeded",
        queued.retryAfter,
      );
      throw error;
    }
    const error = this.errors.get(key);
    if (error) throw error;
  }

  async getProfile(): Promise<GmailProfile> {
    this.calls.push({ method: "getProfile" });
    this.maybeThrow("getProfile");
    const profile = this.profiles[0];
    if (!profile) throw new Error("gmail-profile-missing");
    return { ...profile };
  }

  async listMessages(query: GmailListMessagesQuery): Promise<GmailListPage> {
    const pageToken = query.pageToken ?? null;
    this.calls.push({
      method: "listMessages",
      q: query.q,
      pageToken,
    });
    this.maybeThrow("listMessages");
    this.maybeThrow(`listMessages:${pageToken ?? ""}`);
    const page = this.pages.get(pageToken ?? "") ?? this.defaultPage;
    return {
      messages: page.messages.map((row) => ({ ...row })),
      nextPageToken: page.nextPageToken,
      resultSizeEstimate: page.resultSizeEstimate,
    };
  }

  async getMessage(messageId: string): Promise<GmailApiMessage> {
    this.calls.push({ method: "getMessage", messageId });
    this.maybeThrow(`getMessage:${messageId}`);
    const message = this.messages.get(messageId);
    if (!message) throw new Error("gmail-message-missing");
    return structuredClone(message);
  }

  async getThread(threadId: string): Promise<GmailApiThread> {
    this.calls.push({ method: "getThread", threadId });
    this.maybeThrow(`getThread:${threadId}`);
    const thread = this.threads.get(threadId);
    if (!thread) throw new Error("gmail-thread-missing");
    return structuredClone(thread);
  }

  assertNeverFetchedAttachmentBytes(): void {
    const live = createLiveGmailApi.toString();
    if (/\/attachments\//.test(live) || /messages\.attachments\.get/.test(live)) {
      throw new Error("gmail-attachments-get-forbidden");
    }
  }
}

export class GmailHttpError extends Error {
  readonly status: number;
  readonly reason: string;
  readonly retryAfter: string | null;

  constructor(status: number, reason: string, retryAfter?: string) {
    super(`gmail-http-${status}`);
    this.name = "GmailHttpError";
    this.status = status;
    this.reason = reason;
    this.retryAfter = retryAfter ?? null;
  }
}

export function isRetryableGmailError(error: unknown): boolean {
  if (!(error instanceof GmailHttpError)) return false;
  if (error.status === 429) return true;
  if (error.status !== 403) return false;
  return (
    error.reason === "rateLimitExceeded" ||
    error.reason === "userRateLimitExceeded" ||
    error.reason === "backendError"
  );
}

export function retryDelayMs(
  error: unknown,
  attempt: number,
  baseMs = 500,
): number {
  if (error instanceof GmailHttpError && error.retryAfter) {
    const seconds = Number(error.retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.ceil(seconds * 1000);
    }
  }
  return baseMs * 2 ** Math.max(0, attempt);
}

const GMAIL_API_ROOT = "https://gmail.googleapis.com/gmail/v1/users/me";

/**
 * Live adapter. Constructed only when a real access token is in process memory.
 * This activation task must not invoke it.
 */
export function createLiveGmailApi(accessToken: string): GmailApi {
  async function gmailFetch<T>(path: string): Promise<T> {
    const response = await fetch(`${GMAIL_API_ROOT}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const retryAfter = response.headers.get("Retry-After") ?? undefined;
      throw new GmailHttpError(response.status, "http", retryAfter);
    }
    return (await response.json()) as T;
  }

  return {
    getProfile: () => gmailFetch<GmailProfile>("/profile"),
    listMessages: async (query) => {
      const params = new URLSearchParams();
      params.set("q", query.q);
      params.set("maxResults", String(query.maxResults ?? 100));
      if (query.pageToken) params.set("pageToken", query.pageToken);
      const data = await gmailFetch<{
        messages?: { id: string; threadId: string }[];
        nextPageToken?: string;
        resultSizeEstimate?: number;
      }>(`/messages?${params.toString()}`);
      return {
        messages: data.messages ?? [],
        nextPageToken: data.nextPageToken ?? null,
        resultSizeEstimate: data.resultSizeEstimate,
      };
    },
    getMessage: (messageId) =>
      gmailFetch<GmailApiMessage>(
        `/messages/${encodeURIComponent(messageId)}?format=full`,
      ),
    getThread: (threadId) =>
      gmailFetch<GmailApiThread>(
        `/threads/${encodeURIComponent(threadId)}?format=full`,
      ),
  };
}
