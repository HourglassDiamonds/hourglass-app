"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionPollResult } from "@/lib/shape-studio/session-types";
import {
  pollIndicatesEnded,
  pollIndicatesImageReady,
} from "@/lib/shape-studio/session-lifecycle";

export const SHAPE_STUDIO_POLL_INTERVAL_MS = 1500;

type UseCaptureSessionPollOptions = {
  sessionId: string | null;
  enabled: boolean;
  /**
   * Fired when poll reports image_uploaded + signed URL.
   * Must download + adopt locally before acknowledging.
   * Throw to keep polling (do not treat as delivered).
   */
  onImageReady: (imageUrl: string) => void | Promise<void>;
  onExpired?: () => void;
  onCancelled?: () => void;
  onError?: (message: string) => void;
};

export function useCaptureSessionPoll({
  sessionId,
  enabled,
  onImageReady,
  onExpired,
  onCancelled,
  onError,
}: UseCaptureSessionPollOptions) {
  const [status, setStatus] = useState<SessionPollResult["status"] | "idle">(
    "idle",
  );
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const stoppedRef = useRef(false);
  const adoptingRef = useRef(false);

  const stop = useCallback(() => {
    stoppedRef.current = true;
  }, []);

  useEffect(() => {
    if (!enabled || !sessionId) {
      stoppedRef.current = false;
      adoptingRef.current = false;
      return;
    }

    stoppedRef.current = false;
    adoptingRef.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (stoppedRef.current) return;

      try {
        const res = await fetch(`/api/shape-studio/sessions/${sessionId}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          onError?.(body.message ?? "Unable to check capture session.");
          stop();
          return;
        }

        const data = (await res.json()) as SessionPollResult;
        setStatus(data.status);
        setExpiresAt(data.expiresAt);

        if (
          pollIndicatesImageReady(data) &&
          data.imageUrl &&
          !adoptingRef.current
        ) {
          adoptingRef.current = true;
          try {
            // Signed-URL presence alone does not acknowledge or delete.
            await onImageReady(data.imageUrl);
            stop();
            return;
          } catch {
            adoptingRef.current = false;
            // Keep session recoverable until TTL — continue polling.
          }
        }

        if (data.status === "expired") {
          onExpired?.();
          stop();
          return;
        }

        if (data.status === "cancelled" || pollIndicatesEnded(data)) {
          onCancelled?.();
          stop();
          return;
        }

        if (data.status === "consumed") {
          stop();
          return;
        }
      } catch {
        onError?.("Network error while waiting for phone capture.");
        stop();
        return;
      }

      if (!stoppedRef.current) {
        timer = setTimeout(poll, SHAPE_STUDIO_POLL_INTERVAL_MS);
      }
    };

    void poll();

    return () => {
      stoppedRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    sessionId,
    enabled,
    onImageReady,
    onExpired,
    onCancelled,
    onError,
    stop,
  ]);

  return { status, expiresAt, stopPolling: stop };
}
