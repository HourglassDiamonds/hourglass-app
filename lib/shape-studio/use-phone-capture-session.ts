"use client";

import { useCallback, useRef, useState } from "react";
import {
  type CaptureMode,
  withCaptureMode,
} from "@/lib/shape-studio/types";
import { useCaptureSessionPoll } from "@/lib/shape-studio/use-capture-session-poll";

/** Public Scaled Preview always uses the card-scale capture path. */
export const SCALED_CAPTURE_MODE: CaptureMode = "card-scale";

export type PhoneCapturePhase = "idle" | "creating" | "active";

export type PhoneCaptureSession = {
  phase: PhoneCapturePhase;
  captureUrl: string | null;
  expiresAt: string | null;
  waiting: boolean;
  expired: boolean;
  error: string | null;
  start: () => void;
  cancel: () => void;
};

/**
 * Single authoritative phone-capture session for Scaled Preview.
 * Mount once at the studio root — do not duplicate in rail and stage.
 */
export function usePhoneCaptureSession(
  onImageReceived: (url: string) => void,
): PhoneCaptureSession {
  const creatingRef = useRef(false);
  const [phase, setPhase] = useState<PhoneCapturePhase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [captureUrl, setCaptureUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = useCallback(() => {
    creatingRef.current = false;
    setPhase("idle");
    setSessionId(null);
    setCaptureUrl(null);
    setExpiresAt(null);
    setWaiting(false);
    setExpired(false);
    setError(null);
  }, []);

  const handleImageFromPhone = useCallback(
    (url: string) => {
      setWaiting(false);
      cancel();
      onImageReceived(url);
    },
    [cancel, onImageReceived],
  );

  useCaptureSessionPoll({
    sessionId,
    enabled: phase === "active" && Boolean(sessionId) && !expired,
    onImageReceived: handleImageFromPhone,
    onExpired: () => {
      setExpired(true);
      setWaiting(false);
    },
    onError: (message) => {
      setError(message);
      setWaiting(false);
    },
  });

  const start = useCallback(() => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setPhase("creating");
    setError(null);
    setExpired(false);
    setWaiting(false);
    setSessionId(null);
    setCaptureUrl(null);
    setExpiresAt(null);

    void (async () => {
      try {
        const res = await fetch("/api/shape-studio/sessions", {
          method: "POST",
        });
        const body = (await res.json()) as {
          sessionId?: string;
          captureUrl?: string;
          expiresAt?: string;
          message?: string;
        };

        if (!res.ok || !body.captureUrl) {
          const message =
            body.message ??
            "Phone capture is unavailable. Try again in a moment.";
          creatingRef.current = false;
          setPhase("idle");
          setSessionId(null);
          setCaptureUrl(null);
          setExpiresAt(null);
          setWaiting(false);
          setExpired(false);
          setError(message);
          return;
        }

        setSessionId(body.sessionId ?? null);
        setCaptureUrl(withCaptureMode(body.captureUrl, SCALED_CAPTURE_MODE));
        setExpiresAt(body.expiresAt ?? null);
        setWaiting(true);
        setPhase("active");
      } catch {
        creatingRef.current = false;
        setPhase("idle");
        setSessionId(null);
        setCaptureUrl(null);
        setExpiresAt(null);
        setWaiting(false);
        setExpired(false);
        setError("Could not start phone capture. Try again.");
      } finally {
        creatingRef.current = false;
      }
    })();
  }, []);

  return {
    phase,
    captureUrl,
    expiresAt,
    waiting,
    expired,
    error,
    start,
    cancel,
  };
}
