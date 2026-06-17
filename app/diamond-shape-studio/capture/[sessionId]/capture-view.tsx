"use client";

import { useCallback, useRef, useState } from "react";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/shape-studio/types";
import { isAcceptedCaptureFile } from "@/lib/shape-studio/validate-image";
import { CapturePageStyles } from "./capture-page-styles";

type CaptureViewProps = {
  sessionId: string;
};

type CaptureState = "idle" | "uploading" | "success" | "error";

function uploadErrorMessage(status: number, message?: string): string {
  if (status === 409) {
    return "This session already has a photo. Start a new QR session on desktop.";
  }
  if (status === 410) {
    return "This capture session expired. Scan a new QR code on desktop.";
  }
  if (status === 400 && message) return message;
  return message ?? "Upload failed. Try again.";
}

export function CaptureView({ sessionId }: CaptureViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<CaptureState>("idle");
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!isAcceptedCaptureFile(file)) {
        setError("Please choose a JPG, PNG, or WEBP image.");
        setState("error");
        return;
      }

      setState("uploading");
      setError(null);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(
          `/api/shape-studio/sessions/${sessionId}/upload`,
          { method: "POST", body: formData },
        );
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };

        if (!res.ok) {
          setError(uploadErrorMessage(res.status, body.message));
          setState("error");
          return;
        }

        setState("success");
      } catch {
        setError("Network error. Check your connection and try again.");
        setState("error");
      }
    },
    [sessionId],
  );

  if (state === "success") {
    return (
      <div className="dss-capture-shell">
        <CapturePageStyles />
        <div className="dss-capture-card">
          <p className="dss-capture-brand">HOURGLASS</p>
          <h1 className="dss-capture-title">Photo sent</h1>
          <p className="dss-capture-body">
            Your hand photo has been sent to the desktop viewer.
          </p>
          <p className="dss-capture-hint">
            Return to your computer to compare shapes and carat sizes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dss-capture-shell">
      <CapturePageStyles />
      <div className="dss-capture-card">
        <p className="dss-capture-brand">HOURGLASS</p>
        <h1 className="dss-capture-title">Capture hand photo</h1>
        <p className="dss-capture-body">
          Take or upload a clear photo of your hand. It will appear on the
          desktop Shape Studio viewer.
        </p>

        <button
          type="button"
          className="dss-capture-primary"
          disabled={state === "uploading"}
          onClick={() => inputRef.current?.click()}
        >
          {state === "uploading" ? "Uploading…" : "Take or choose photo"}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
          }}
        />

        {error ? <p className="dss-capture-error">{error}</p> : null}

        <p className="dss-capture-hint">JPG, PNG, or WEBP · Max 10 MB</p>
      </div>
    </div>
  );
}
