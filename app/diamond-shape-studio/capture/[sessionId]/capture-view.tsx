"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type CaptureMode } from "@/lib/shape-studio/types";
import { prepareCaptureFile } from "@/lib/shape-studio/prepare-capture-file";
import {
  captureGateUserMessage,
  evaluateCaptureGate,
  pollIndicatesDelivered,
  pollIndicatesEnded,
} from "@/lib/shape-studio/session-lifecycle";
import type { CaptureGateResult } from "@/lib/shape-studio/session-types";
import type { SessionPollResult } from "@/lib/shape-studio/session-types";
import { HandCardCaptureGuide } from "@/app/diamond-shape-studio/components/hand-card-capture-guide";
import { CapturePageStyles } from "./capture-page-styles";

const CAPTURE_INPUT_ID = "dss-capture-file-input";
const UPLOAD_TIMEOUT_MS = 45_000;
const ACK_POLL_MS = 1500;

type CaptureViewProps = {
  sessionId: string;
  captureMode: CaptureMode;
  initialGate: CaptureGateResult;
};

type CaptureState =
  | "blocked"
  | "idle"
  | "preparing"
  | "uploading"
  | "uploaded_waiting"
  | "delivered"
  | "ended"
  | "error";

function uploadErrorMessage(status: number, message?: string): string {
  if (status === 409) {
    return "This session already has a photo. Start a new QR session on desktop.";
  }
  if (status === 410) {
    return "This capture session expired. Scan a new QR code on desktop.";
  }
  if (status === 413) {
    return "Photo is too large (max 10 MB). Try again with a smaller image.";
  }
  if (status === 404) {
    return "This capture link is not valid. Return to See It On Your Hand on your computer and create a new capture session.";
  }
  if (status === 400 && message) return message;
  return message ?? "Upload failed. Try again.";
}

function modeCopy(_mode: CaptureMode) {
  void _mode;
  return {
    title: "Capture for See It On Your Hand",
    instruction:
      "Place a blank gift card, hotel key, or standard-size loyalty card beside your hand on the same surface. Photograph from directly overhead. Keep the card’s full long edge visible. Avoid cards showing personal or financial information.",
    note: "On desktop, mark the card’s long edge to set visual scale, then frame the card out of your final preview. Final ring sizing should be confirmed by a jeweler.",
  };
}

function ctaLabel(state: CaptureState): string {
  if (state === "preparing") return "Preparing photo…";
  if (state === "uploading") return "Uploading…";
  return "Take or choose photo";
}

function gateToBlockedState(gate: CaptureGateResult): {
  state: CaptureState;
  title: string;
  body: string;
} {
  if (gate.reason === "consumed") {
    return {
      state: "delivered",
      title: "Photo received on your computer.",
      body: "Return to See It On Your Hand on your desktop to mark the card, frame your hand, and preview the diamond.",
    };
  }
  if (gate.reason === "already_uploaded") {
    return {
      state: "uploaded_waiting",
      title: "Photo uploaded. Waiting for your computer to receive it…",
      body: "Keep this page open. Your computer must still be waiting on the See It On Your Hand QR screen.",
    };
  }
  return {
    state: "blocked",
    title: "Capture unavailable",
    body: captureGateUserMessage(gate.reason),
  };
}

export function CaptureView({
  sessionId,
  captureMode,
  initialGate,
}: CaptureViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);
  const handledTokenRef = useRef<string | null>(null);
  const uploadFileRef = useRef<(file: File) => Promise<void>>(async () => undefined);
  const initial = gateToBlockedState(initialGate);
  const [state, setState] = useState<CaptureState>(
    initialGate.allowed ? "idle" : initial.state,
  );
  const [title, setTitle] = useState(
    initialGate.allowed ? modeCopy(captureMode).title : initial.title,
  );
  const [body, setBody] = useState(
    initialGate.allowed ? modeCopy(captureMode).instruction : initial.body,
  );
  const [error, setError] = useState<string | null>(null);
  const [waitingHint, setWaitingHint] = useState(false);
  const copy = modeCopy(captureMode);
  const busy = state === "preparing" || state === "uploading";
  const captureEnabled = state === "idle" || state === "error";

  const resetForRetry = useCallback(() => {
    inFlightRef.current = false;
    handledTokenRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const applyPollStatus = useCallback((session: SessionPollResult) => {
    if (pollIndicatesDelivered(session)) {
      setState("delivered");
      setTitle("Photo received on your computer.");
      setBody(
        "Return to See It On Your Hand on your desktop to mark the card, frame your hand, and preview the diamond.",
      );
      setWaitingHint(false);
      setError(null);
      return;
    }
    if (pollIndicatesEnded(session)) {
      setState("ended");
      setTitle("Capture session ended");
      setBody(captureGateUserMessage("cancelled"));
      setWaitingHint(false);
      return;
    }
    if (session.status === "image_uploaded") {
      setState("uploaded_waiting");
      setTitle("Photo uploaded. Waiting for your computer to receive it…");
      setBody(
        waitingHint
          ? "Your photograph was uploaded, but the preview has not received it yet."
          : "Keep this page open while your computer receives the photograph.",
      );
    }
  }, [waitingHint]);

  const refreshSessionStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/shape-studio/sessions/${sessionId}`);
      if (res.status === 404) {
        setState("blocked");
        setTitle("Capture unavailable");
        setBody(captureGateUserMessage("not_found"));
        return;
      }
      if (!res.ok) return;
      const session = (await res.json()) as SessionPollResult;
      const gate = evaluateCaptureGate(session);
      if (state === "idle" || state === "error" || state === "blocked") {
        if (!gate.allowed && gate.reason !== "already_uploaded") {
          const blocked = gateToBlockedState(gate);
          setState(blocked.state);
          setTitle(blocked.title);
          setBody(blocked.body);
          return;
        }
      }
      applyPollStatus(session);
    } catch {
      /* keep current state */
    }
  }, [applyPollStatus, sessionId, state]);

  useEffect(() => {
    if (state !== "uploaded_waiting") return;
    const id = window.setInterval(() => {
      void refreshSessionStatus();
    }, ACK_POLL_MS);
    const hintTimer = window.setTimeout(() => setWaitingHint(true), 20_000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(hintTimer);
    };
  }, [refreshSessionStatus, state]);

  useEffect(() => {
    if (initialGate.reason === "already_uploaded") {
      void refreshSessionStatus();
    }
  }, [initialGate.reason, refreshSessionStatus]);

  const uploadFile = useCallback(
    async (rawFile: File) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      setState("preparing");
      setError(null);
      setTitle(copy.title);
      setBody("Uploading your photograph…");

      let file: File;
      try {
        file = await prepareCaptureFile(rawFile);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Please choose a JPG, PNG, or WEBP image.";
        setError(message);
        setState("error");
        setBody(copy.instruction);
        resetForRetry();
        return;
      }

      setState("uploading");
      setBody("Uploading your photograph…");

      const formData = new FormData();
      formData.append("file", file);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        UPLOAD_TIMEOUT_MS,
      );

      try {
        const res = await fetch(
          `/api/shape-studio/sessions/${sessionId}/upload`,
          { method: "POST", body: formData, signal: controller.signal },
        );
        const bodyJson = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        const bodyMessage = bodyJson.message ?? bodyJson.error;

        if (!res.ok) {
          setError(uploadErrorMessage(res.status, bodyMessage));
          setState("error");
          setBody(copy.instruction);
          resetForRetry();
          return;
        }

        setState("uploaded_waiting");
        setTitle("Photo uploaded. Waiting for your computer to receive it…");
        setBody(
          "Keep this page open while your computer receives the photograph.",
        );
        setWaitingHint(false);
        setError(null);
      } catch (err) {
        const aborted =
          err instanceof DOMException && err.name === "AbortError";
        setError(
          aborted
            ? "Upload timed out. Check your Wi‑Fi and try again."
            : "Network error. Check your connection and try again.",
        );
        setState("error");
        setBody(copy.instruction);
        resetForRetry();
      } finally {
        window.clearTimeout(timeoutId);
        inFlightRef.current = false;
      }
    },
    [copy.instruction, copy.title, resetForRetry, sessionId],
  );

  uploadFileRef.current = uploadFile;

  const consumeInputFile = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;

    const file = input.files?.[0] ?? null;
    if (!file) return;

    const token = `${file.name}:${file.size}:${file.lastModified}`;
    if (handledTokenRef.current === token || inFlightRef.current) return;

    handledTokenRef.current = token;
    void uploadFileRef.current(file);
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const onChange = () => consumeInputFile();
    const onResume = () => {
      window.setTimeout(consumeInputFile, 0);
      window.setTimeout(consumeInputFile, 250);
    };

    input.addEventListener("change", onChange);
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);
    const onVisibility = () => {
      if (document.visibilityState === "visible") onResume();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      input.removeEventListener("change", onChange);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [consumeInputFile]);

  const showGuide = state === "idle" || state === "error";
  const showFileControl = captureEnabled;
  const liveMessage =
    state === "preparing" ||
    state === "uploading" ||
    state === "uploaded_waiting" ||
    state === "delivered" ||
    state === "ended" ||
    state === "blocked"
      ? title
      : undefined;

  return (
    <div className="dss-capture-shell">
      <CapturePageStyles />
      <div className="dss-capture-card" aria-live="polite" aria-atomic="true">
        <p className="dss-capture-brand">HOURGLASS</p>
        <h1 className="dss-capture-title">{title}</h1>
        <p className="dss-capture-body">{body}</p>

        {showGuide ? <HandCardCaptureGuide /> : null}
        {showGuide ? <p className="dss-capture-note">{copy.note}</p> : null}

        {showFileControl ? (
          <div
            className={`dss-capture-file-control${busy ? " is-busy" : ""}`}
          >
            <span className="dss-capture-primary" aria-hidden="true">
              {ctaLabel(state)}
            </span>
            <input
              ref={inputRef}
              id={CAPTURE_INPUT_ID}
              type="file"
              accept="image/*"
              capture="environment"
              className="dss-capture-file-input"
              aria-label="Take or choose photo"
              disabled={busy}
            />
          </div>
        ) : null}

        {state === "uploaded_waiting" ? (
          <div className="dss-capture-actions">
            <button
              type="button"
              className="dss-capture-secondary"
              onClick={() => void refreshSessionStatus()}
            >
              Check status
            </button>
          </div>
        ) : null}

        {state === "error" && error ? (
          <p className="dss-capture-error" role="alert">
            {error}
          </p>
        ) : null}
        {showFileControl ? (
          <p className="dss-capture-hint">JPG, PNG, or WEBP · Max 10 MB</p>
        ) : null}
        {liveMessage ? (
          <span className="sr-only">{liveMessage}</span>
        ) : null}
      </div>
    </div>
  );
}
