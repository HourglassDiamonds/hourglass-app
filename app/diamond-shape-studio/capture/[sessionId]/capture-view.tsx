"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type CaptureMode } from "@/lib/shape-studio/types";
import { prepareCaptureFile } from "@/lib/shape-studio/prepare-capture-file";
import { CapturePageStyles } from "./capture-page-styles";

const CAPTURE_INPUT_ID = "dss-capture-file-input";
const UPLOAD_TIMEOUT_MS = 45_000;

type CaptureViewProps = {
  sessionId: string;
  captureMode: CaptureMode;
};

type CaptureState = "idle" | "preparing" | "uploading" | "success" | "error";

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
  if (status === 400 && message) return message;
  return message ?? "Upload failed. Try again.";
}

function modeCopy(mode: CaptureMode) {
  if (mode === "card-scale") {
    return {
      title: "Capture with a visual reference",
      instruction:
        "Place a blank gift card, hotel key, or standard-size loyalty card beside your hand. Avoid cards showing personal or financial information.",
      note: "On desktop, mark the card’s long edge to scale the diamond preview. Final ring size should still be confirmed by a jeweler.",
    };
  }
  return {
    title: "Capture your hand photo",
    instruction: "Place your ring finger clearly in frame.",
    note: "Your selected ring size on desktop helps guide this visual preview.",
  };
}

function CaptureGuide({ mode }: { mode: CaptureMode }) {
  if (mode === "card-scale") {
    return (
      <div className="dss-capture-guide dss-capture-guide--card" aria-hidden>
        <div className="dss-capture-guide-frame">
          <span className="dss-capture-guide-card" />
          <span className="dss-capture-guide-lane" />
          <span className="dss-capture-guide-dot dss-capture-guide-dot--a" />
          <span className="dss-capture-guide-dot dss-capture-guide-dot--b" />
          <span className="dss-capture-guide-dot dss-capture-guide-dot--c" />
          <span className="dss-capture-guide-ring" />
        </div>
        <p className="dss-capture-guide-caption">Hand + blank card in frame</p>
      </div>
    );
  }

  return (
    <div className="dss-capture-guide dss-capture-guide--known" aria-hidden>
      <div className="dss-capture-guide-frame">
        <span className="dss-capture-guide-lane" />
        <span className="dss-capture-guide-dot dss-capture-guide-dot--a" />
        <span className="dss-capture-guide-dot dss-capture-guide-dot--b" />
        <span className="dss-capture-guide-dot dss-capture-guide-dot--c" />
        <span className="dss-capture-guide-ring" />
      </div>
      <p className="dss-capture-guide-caption">Ring finger lane</p>
    </div>
  );
}

function ctaLabel(state: CaptureState): string {
  if (state === "preparing") return "Preparing photo…";
  if (state === "uploading") return "Uploading…";
  return "Take or choose photo";
}

export function CaptureView({ sessionId, captureMode }: CaptureViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);
  const handledTokenRef = useRef<string | null>(null);
  const uploadFileRef = useRef<(file: File) => Promise<void>>(async () => undefined);
  const [state, setState] = useState<CaptureState>("idle");
  const [error, setError] = useState<string | null>(null);
  const copy = modeCopy(captureMode);
  const busy = state === "preparing" || state === "uploading";

  const resetForRetry = useCallback(() => {
    inFlightRef.current = false;
    handledTokenRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const uploadFile = useCallback(
    async (rawFile: File) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      setState("preparing");
      setError(null);

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
        resetForRetry();
        return;
      }

      setState("uploading");

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
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        const bodyMessage = body.message ?? body.error;

        if (!res.ok) {
          setError(uploadErrorMessage(res.status, bodyMessage));
          setState("error");
          resetForRetry();
          return;
        }

        setState("success");
      } catch (err) {
        const aborted =
          err instanceof DOMException && err.name === "AbortError";
        setError(
          aborted
            ? "Upload timed out. Check your Wi‑Fi and try again."
            : "Network error. Check your connection and try again.",
        );
        setState("error");
        resetForRetry();
      } finally {
        window.clearTimeout(timeoutId);
        inFlightRef.current = false;
      }
    },
    [resetForRetry, sessionId],
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

  // Native change listener is more reliable than React onChange on iOS Safari.
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

  return (
    <div className="dss-capture-shell">
      <CapturePageStyles />
      <div className="dss-capture-card">
        {state === "success" ? (
          <>
            <p className="dss-capture-brand">HOURGLASS</p>
            <h1 className="dss-capture-title">Photo sent</h1>
            <p className="dss-capture-body">
              Your hand photo has been sent to the desktop viewer.
            </p>
            <p className="dss-capture-hint">
              Return to your desktop viewer to compare shapes and carat sizes.
            </p>
          </>
        ) : (
          <>
            <p className="dss-capture-brand">HOURGLASS</p>
            <h1 className="dss-capture-title">{copy.title}</h1>
            <p className="dss-capture-body">{copy.instruction}</p>

            <CaptureGuide mode={captureMode} />

            <p className="dss-capture-note">{copy.note}</p>
          </>
        )}

        {/*
          Transparent <input type="file"> is the sole tappable control.
          Styled CTA sits underneath (pointer-events:none). No <label>.
          Input stays mounted for the whole page lifetime.
        */}
        <div
          className={`dss-capture-file-control${busy ? " is-busy" : ""}${state === "success" ? " is-hidden" : ""}`}
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
          />
        </div>

        {state !== "success" && error ? (
          <p className="dss-capture-error">{error}</p>
        ) : null}
        {state !== "success" ? (
          <p className="dss-capture-hint">JPG, PNG, or WEBP · Max 10 MB</p>
        ) : null}
      </div>
    </div>
  );
}
