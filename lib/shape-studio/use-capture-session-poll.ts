"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionPollResult } from "@/lib/shape-studio/session-types";

export const SHAPE_STUDIO_POLL_INTERVAL_MS = 1500;

type UseCaptureSessionPollOptions = {
  sessionId: string | null;
  enabled: boolean;
  onImageReceived: (imageUrl: string) => void;
  onExpired?: () => void;
  onError?: (message: string) => void;
};

export function useCaptureSessionPoll({
  sessionId,
  enabled,
  onImageReceived,
  onExpired,
  onError,
}: UseCaptureSessionPollOptions) {
  const [status, setStatus] = useState<SessionPollResult["status"] | "idle">(
    "idle",
  );
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const stoppedRef = useRef(false);

  const stop = useCallback(() => {
    stoppedRef.current = true;
  }, []);

  useEffect(() => {
    if (!enabled || !sessionId) {
      stoppedRef.current = false;
      setStatus("idle");
      setExpiresAt(null);
      return;
    }

    stoppedRef.current = false;
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

        if (data.status === "image_uploaded" && data.imageUrl) {
          onImageReceived(data.imageUrl);
          stop();
          return;
        }

        if (data.status === "expired") {
          onExpired?.();
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
  }, [sessionId, enabled, onImageReceived, onExpired, onError, stop]);

  return { status, expiresAt, stopPolling: stop };
}
