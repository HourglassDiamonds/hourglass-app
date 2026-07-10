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

function leadCopy(mode: CaptureMode): string {
  if (mode === "card-scale") {
    return "Scan to capture your hand with a standard card in frame. Use a card for scale — this helps us calibrate the preview more carefully.";
  }
  return "Scan to capture a clean hand photo. Your selected ring size will guide the preview scale.";
}

export function QrCapturePanel({
  captureUrl,
  captureMode,
  expiresAt,
  waiting,
  expired,
  error,
  onCancel,
}: QrCapturePanelProps) {
  if (expired) {
    return (
      <div className="dss-qr-panel">
        <p className="dss-qr-message dss-qr-message--warn">
          This capture session expired. Start a new QR session to try again.
        </p>
        <button type="button" className="dss-qr-cancel" onClick={onCancel}>
          Back to upload options
        </button>
      </div>
    );
  }

  return (
    <div className="dss-qr-panel">
      <p className="dss-qr-lead">{leadCopy(captureMode)}</p>
      <div className="dss-qr-frame" aria-hidden={!captureUrl}>
        <QRCode
          value={captureUrl}
          size={148}
          bgColor="#faf8f5"
          fgColor="#2a2824"
          style={{ height: "auto", maxWidth: "100%", width: "148px" }}
        />
      </div>
      <p className="dss-qr-status">
        {waiting ? "Waiting for phone capture…" : "Ready to scan"}
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
