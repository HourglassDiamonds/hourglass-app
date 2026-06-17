"use client";

import { useCallback, useRef, useState } from "react";
import {
  ACCEPTED_IMAGE_EXTENSIONS,
  ACCEPTED_IMAGE_TYPES,
} from "@/lib/shape-studio/types";
import { useCaptureSessionPoll } from "@/lib/shape-studio/use-capture-session-poll";
import { QrCapturePanel } from "./qr-capture-panel";

type HandPhotoPanelProps = {
  onImageSelected: (url: string) => void;
};

type UploadMode = "device" | "phone";

function isAcceptedFile(file: File): boolean {
  if (
    ACCEPTED_IMAGE_TYPES.includes(
      file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
    )
  ) {
    return true;
  }
  const lower = file.name.toLowerCase();
  return ACCEPTED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function HandPhotoPanel({ onImageSelected }: HandPhotoPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState<UploadMode>("device");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [captureUrl, setCaptureUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrExpired, setQrExpired] = useState(false);
  const [phoneWaiting, setPhoneWaiting] = useState(false);

  const resetPhoneCapture = useCallback(() => {
    setMode("device");
    setSessionId(null);
    setCaptureUrl(null);
    setExpiresAt(null);
    setQrError(null);
    setQrExpired(false);
    setPhoneWaiting(false);
    setCreatingSession(false);
  }, []);

  const handleImageFromDevice = useCallback(
    (file: File | null | undefined) => {
      if (!file || !isAcceptedFile(file)) return;
      resetPhoneCapture();
      const url = URL.createObjectURL(file);
      onImageSelected(url);
    },
    [onImageSelected, resetPhoneCapture],
  );

  const handleImageFromPhone = useCallback(
    (url: string) => {
      setPhoneWaiting(false);
      resetPhoneCapture();
      onImageSelected(url);
    },
    [onImageSelected, resetPhoneCapture],
  );

  useCaptureSessionPoll({
    sessionId,
    enabled: mode === "phone" && Boolean(sessionId) && !qrExpired,
    onImageReceived: handleImageFromPhone,
    onExpired: () => {
      setQrExpired(true);
      setPhoneWaiting(false);
    },
    onError: (message) => {
      setQrError(message);
      setPhoneWaiting(false);
    },
  });

  const startPhoneCapture = useCallback(async () => {
    setMode("phone");
    setCreatingSession(true);
    setQrError(null);
    setQrExpired(false);
    setPhoneWaiting(false);

    try {
      const res = await fetch("/api/shape-studio/sessions", { method: "POST" });
      const body = (await res.json()) as {
        sessionId?: string;
        captureUrl?: string;
        expiresAt?: string;
        message?: string;
      };

      if (!res.ok) {
        setQrError(
          body.message ??
            "Phone capture is unavailable. Upload from this device instead.",
        );
        setMode("device");
        return;
      }

      setSessionId(body.sessionId ?? null);
      setCaptureUrl(body.captureUrl ?? null);
      setExpiresAt(body.expiresAt ?? null);
      setPhoneWaiting(true);
    } catch {
      setQrError("Could not start phone capture. Try again or upload locally.");
      setMode("device");
    } finally {
      setCreatingSession(false);
    }
  }, []);

  return (
    <section className="dss-card" aria-label="Hand photo">
      <div className="dss-card-head">Hand Photo</div>

      <div className="dss-upload-mode-row">
        <button
          type="button"
          className={`dss-upload-mode-btn${mode === "device" ? " is-active" : ""}`}
          onClick={() => {
            if (mode !== "device") resetPhoneCapture();
            setMode("device");
          }}
        >
          This device
        </button>
        <button
          type="button"
          className={`dss-upload-mode-btn${mode === "phone" ? " is-active" : ""}`}
          onClick={() => {
            if (mode === "phone" && sessionId) return;
            void startPhoneCapture();
          }}
          disabled={creatingSession}
        >
          Phone via QR
        </button>
      </div>

      {mode === "device" ? (
        <>
          <div
            className={`dss-upload-zone${dragOver ? " is-dragover" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleImageFromDevice(e.dataTransfer.files[0]);
            }}
          >
            <p>Drag and drop a hand photo, or choose a file.</p>
            <span className="dss-upload-cta">Upload JPG, PNG, or WEBP</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            capture="environment"
            className="sr-only"
            onChange={(e) => handleImageFromDevice(e.target.files?.[0])}
          />
        </>
      ) : creatingSession ? (
        <p className="dss-qr-loading">Preparing QR capture session…</p>
      ) : captureUrl && expiresAt ? (
        <QrCapturePanel
          captureUrl={captureUrl}
          expiresAt={expiresAt}
          waiting={phoneWaiting}
          expired={qrExpired}
          error={qrError}
          onCancel={resetPhoneCapture}
        />
      ) : (
        <p className="dss-qr-message dss-qr-message--warn">
          {qrError ?? "Unable to start phone capture."}
        </p>
      )}
    </section>
  );
}
