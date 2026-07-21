"use client";

import QRCode from "react-qr-code";
import type { CaptureMode } from "@/lib/shape-studio/types";

type QrCapturePanelProps = {
  captureUrl: string;
  captureMode: CaptureMode;
  expiresAt: string;
  waiting: boolean;
  expired: boolean;
  error: string | null;
  onCancel: () => void;
  /** Larger centered presentation for the pre-photo entry. */
  variant?: "rail" | "stage";
};

function formatExpiry(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function QrCapturePanel({
  captureUrl,
  captureMode: _captureMode,
  expiresAt,
  waiting,
  expired,
  error,
  onCancel,
  variant = "stage",
}: QrCapturePanelProps) {
  void _captureMode;
  const stage = variant === "stage";

  if (expired) {
    return (
      <div className={`dss-qr-panel${stage ? " dss-qr-panel--stage" : ""}`}>
        {stage ? (
          <p className="dss-stage-empty-title">Scan with your phone</p>
        ) : null}
        <p className="dss-qr-message dss-qr-message--warn">
          This capture session expired. Start a new QR session to try again.
        </p>
        <button type="button" className="dss-qr-cancel" onClick={onCancel}>
          Cancel phone capture
        </button>
      </div>
    );
  }

  return (
    <div className={`dss-qr-panel${stage ? " dss-qr-panel--stage" : ""}`}>
      {stage ? (
        <>
          <p className="dss-stage-empty-kicker">See It On Your Hand</p>
          <p className="dss-stage-empty-title">Scan with your phone</p>
          <p className="dss-qr-lead">
            Photograph your hand with a standard-size card beside it. Keep the
            card and hand on approximately the same plane.
          </p>
        </>
      ) : (
        <p className="dss-qr-lead">
          Photograph your hand with a standard-size card beside it. Keep the
          card and hand on approximately the same plane.
        </p>
      )}
      <div className="dss-qr-frame" aria-hidden={!captureUrl}>
        <QRCode
          value={captureUrl}
          size={stage ? 208 : 148}
          bgColor="#faf8f5"
          fgColor="#2a2824"
          style={{
            height: "auto",
            maxWidth: "100%",
            width: stage ? "208px" : "148px",
          }}
        />
      </div>
      <p className="dss-qr-status">
        {waiting ? "Waiting for phone capture…" : "Ready on your phone"}
      </p>
      {expiresAt ? (
        <p className="dss-qr-meta">Session expires at {formatExpiry(expiresAt)}</p>
      ) : null}
      {error ? <p className="dss-qr-message dss-qr-message--warn">{error}</p> : null}
      <button type="button" className="dss-qr-cancel" onClick={onCancel}>
        Cancel phone capture
      </button>
    </div>
  );
}
