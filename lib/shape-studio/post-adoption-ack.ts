/**
 * Post-adoption acknowledgement helpers for Scaled Preview phone capture.
 * Pure / injectable for focused tests — no React.
 */

export const ACK_BACKOFF_MS = [1500, 3000, 5000, 10_000] as const;

export type AcknowledgeAttemptResult =
  | { kind: "success" }
  | { kind: "already_consumed" }
  | {
      kind: "terminal";
      reason: "cancelled" | "expired" | "not_found" | "no_image" | "unknown";
    }
  | { kind: "retryable"; status?: number };

export function nextAckBackoffMs(attemptIndex: number): number {
  const i = Math.max(0, Math.min(attemptIndex, ACK_BACKOFF_MS.length - 1));
  return ACK_BACKOFF_MS[i]!;
}

export async function attemptAcknowledgeCaptureSession(
  sessionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AcknowledgeAttemptResult> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/shape-studio/sessions/${sessionId}/acknowledge`, {
      method: "POST",
    });
  } catch {
    return { kind: "retryable" };
  }

  if (res.ok) {
    const body = (await res.json().catch(() => ({}))) as { status?: string };
    if (body.status === "consumed") {
      return { kind: "already_consumed" };
    }
    return { kind: "success" };
  }

  if (res.status === 404) {
    return { kind: "terminal", reason: "not_found" };
  }

  if (res.status === 409) {
    // No image to acknowledge — typically cancelled/expired after adoption.
    return { kind: "terminal", reason: "no_image" };
  }

  if (res.status === 400) {
    return { kind: "terminal", reason: "unknown" };
  }

  if (res.status >= 500 || res.status === 503) {
    return { kind: "retryable", status: res.status };
  }

  return { kind: "retryable", status: res.status };
}

export type PostAdoptionAckControllerOptions = {
  adoptRemote: (imageUrl: string) => Promise<{ objectUrl: string }>;
  onImageReceived: (objectUrl: string) => void;
  acknowledge: (
    sessionId: string,
  ) => Promise<AcknowledgeAttemptResult>;
  /** Optional delay between retryable ack failures (tests inject fake timers). */
  wait?: (ms: number) => Promise<void>;
  now?: () => number;
};

/**
 * Session-scoped adopt-once + durable acknowledgement retry.
 * Throw from handleImageReady to keep the poll loop alive on retryable ack failure.
 */
export function createPostAdoptionAckController(
  options: PostAdoptionAckControllerOptions,
) {
  const wait =
    options.wait ??
    ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  let activeSessionId: string | null = null;
  let adoptedSessionId: string | null = null;
  let ackAttemptIndex = 0;
  let ackInFlight = false;
  let adoptInFlight = false;
  let generation = 0;
  let completedGeneration = -1;
  let disposed = false;

  function isCurrent(sessionId: string, gen: number): boolean {
    return (
      !disposed &&
      gen === generation &&
      activeSessionId === sessionId &&
      sessionId === adoptedSessionId
    );
  }

  function bindSession(sessionId: string | null) {
    // New session replaces prior retry state.
    generation += 1;
    activeSessionId = sessionId;
    adoptedSessionId = null;
    ackAttemptIndex = 0;
    ackInFlight = false;
    adoptInFlight = false;
  }

  function dispose() {
    disposed = true;
    generation += 1;
    activeSessionId = null;
    adoptedSessionId = null;
    ackInFlight = false;
    adoptInFlight = false;
  }

  /**
   * User cancel / Start over — invalidate in-flight work; caller issues DELETE.
   */
  function cancelLocal() {
    generation += 1;
    activeSessionId = null;
    adoptedSessionId = null;
    ackAttemptIndex = 0;
    ackInFlight = false;
    adoptInFlight = false;
  }

  async function handleImageReady(
    sessionId: string,
    imageUrl: string,
  ): Promise<"cleared" | "terminal_cleared"> {
    if (disposed) {
      throw new Error("controller_disposed");
    }
    if (activeSessionId !== sessionId) {
      throw new Error("stale_session");
    }

    const gen = generation;

    if (adoptedSessionId !== sessionId) {
      if (adoptInFlight || ackInFlight) {
        throw new Error("ack_in_flight");
      }
      adoptInFlight = true;
      try {
        const adopted = await options.adoptRemote(imageUrl);
        if (disposed || gen !== generation || activeSessionId !== sessionId) {
          throw new Error("stale_session");
        }
        adoptedSessionId = sessionId;
        options.onImageReceived(adopted.objectUrl);
      } finally {
        adoptInFlight = false;
      }
    }

    if (ackInFlight) {
      throw new Error("ack_in_flight");
    }

    // Backoff before ack attempts after the first failure cycle.
    if (ackAttemptIndex > 0) {
      await wait(nextAckBackoffMs(ackAttemptIndex - 1));
      if (!isCurrent(sessionId, gen)) {
        throw new Error("stale_session");
      }
    }

    ackInFlight = true;
    let result: AcknowledgeAttemptResult;
    try {
      result = await options.acknowledge(sessionId);
    } finally {
      ackInFlight = false;
    }

    if (
      !isCurrent(sessionId, gen) &&
      result.kind !== "success" &&
      result.kind !== "already_consumed"
    ) {
      // Late response after cancel/new session — ignore.
      throw new Error("stale_session");
    }

    // Stale success must not clear a newer session.
    if (gen !== generation || activeSessionId !== sessionId) {
      throw new Error("stale_session");
    }

    if (result.kind === "success" || result.kind === "already_consumed") {
      if (completedGeneration === gen) {
        return "cleared";
      }
      completedGeneration = gen;
      activeSessionId = null;
      adoptedSessionId = null;
      ackAttemptIndex = 0;
      return "cleared";
    }

    if (result.kind === "terminal") {
      activeSessionId = null;
      adoptedSessionId = null;
      ackAttemptIndex = 0;
      return "terminal_cleared";
    }

    // Retryable — keep adopted marker and session; signal poll to continue.
    ackAttemptIndex += 1;
    throw new Error("ack_retryable");
  }

  return {
    bindSession,
    cancelLocal,
    dispose,
    handleImageReady,
    /** Test / debug accessors */
    getAdoptedSessionId: () => adoptedSessionId,
    getActiveSessionId: () => activeSessionId,
    getAckAttemptIndex: () => ackAttemptIndex,
    isAckInFlight: () => ackInFlight,
    getGeneration: () => generation,
  };
}

export type PostAdoptionAckController = ReturnType<
  typeof createPostAdoptionAckController
>;
