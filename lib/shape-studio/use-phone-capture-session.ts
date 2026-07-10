"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type CaptureMode,
  withCaptureMode,
} from "@/lib/shape-studio/types";
import { adoptRemoteCaptureImage } from "@/lib/shape-studio/adopt-capture-image";
import {
  attemptAcknowledgeCaptureSession,
  createPostAdoptionAckController,
} from "@/lib/shape-studio/post-adoption-ack";
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
 *
 * After local adoption, acknowledgement failures keep the session and retry
 * without redownload. clearLocal runs only after ack success / already consumed,
 * or when clearing relay state after terminal/cancel (adopted preview is kept).
 */
export function usePhoneCaptureSession(
  onImageReceived: (url: string) => void,
): PhoneCaptureSession {
  const creatingRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const onImageReceivedRef = useRef(onImageReceived);
  onImageReceivedRef.current = onImageReceived;

  const controllerRef = useRef(
    createPostAdoptionAckController({
      adoptRemote: adoptRemoteCaptureImage,
      onImageReceived: (url) => onImageReceivedRef.current(url),
      acknowledge: attemptAcknowledgeCaptureSession,
    }),
  );

  const [phase, setPhase] = useState<PhoneCapturePhase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [captureUrl, setCaptureUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = controllerRef.current;
    return () => {
      controller.dispose();
    };
  }, []);

  const clearLocal = useCallback(() => {
    creatingRef.current = false;
    sessionIdRef.current = null;
    controllerRef.current.cancelLocal();
    setPhase("idle");
    setSessionId(null);
    setCaptureUrl(null);
    setExpiresAt(null);
    setWaiting(false);
    setExpired(false);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    const id = sessionIdRef.current;
    // Invalidate retries before DELETE so late ack cannot complete the relay.
    clearLocal();
    if (!id) return;
    void fetch(`/api/shape-studio/sessions/${id}`, { method: "DELETE" }).catch(
      () => undefined,
    );
  }, [clearLocal]);

  const handleImageReady = useCallback(
    async (imageUrl: string) => {
      const id = sessionIdRef.current;
      if (!id) {
        throw new Error("missing_session");
      }

      try {
        const outcome = await controllerRef.current.handleImageReady(
          id,
          imageUrl,
        );
        // Adoption succeeded at least once; desktop preview is populated.
        setWaiting(false);
        setError(null);

        if (outcome === "cleared") {
          // Ack success or already consumed — end relay.
          clearLocal();
          return;
        }

        if (outcome === "terminal_cleared") {
          // Cancelled / expired / unknown after adoption — keep preview, end relay.
          clearLocal();
          return;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (
          message === "ack_retryable" ||
          message === "ack_in_flight" ||
          message === "stale_session"
        ) {
          // Keep session + adopted marker; poll continues for ack-only retries.
          setWaiting(false);
          setError(null);
          throw err;
        }

        setError(
          "Could not load the photograph from your phone. Keep this page open — we will retry.",
        );
        throw err;
      }
    },
    [clearLocal],
  );

  useCaptureSessionPoll({
    sessionId,
    enabled: phase === "active" && Boolean(sessionId) && !expired,
    onImageReady: handleImageReady,
    onExpired: () => {
      controllerRef.current.cancelLocal();
      setExpired(true);
      setWaiting(false);
      sessionIdRef.current = null;
      setSessionId(null);
      setCaptureUrl(null);
      setPhase("idle");
    },
    onCancelled: () => {
      controllerRef.current.cancelLocal();
      setExpired(true);
      setWaiting(false);
      setError(
        "This capture session ended. Start a new QR session to try again.",
      );
      sessionIdRef.current = null;
      setSessionId(null);
      setCaptureUrl(null);
      setPhase("idle");
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
    sessionIdRef.current = null;
    controllerRef.current.bindSession(null);
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
          sessionIdRef.current = null;
          controllerRef.current.bindSession(null);
          setCaptureUrl(null);
          setExpiresAt(null);
          setWaiting(false);
          setExpired(false);
          setError(message);
          return;
        }

        const id = body.sessionId ?? null;
        sessionIdRef.current = id;
        controllerRef.current.bindSession(id);
        setSessionId(id);
        setCaptureUrl(withCaptureMode(body.captureUrl, SCALED_CAPTURE_MODE));
        setExpiresAt(body.expiresAt ?? null);
        setWaiting(true);
        setPhase("active");
      } catch {
        creatingRef.current = false;
        setPhase("idle");
        setSessionId(null);
        sessionIdRef.current = null;
        controllerRef.current.bindSession(null);
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
