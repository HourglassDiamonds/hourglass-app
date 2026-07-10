"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ACCEPTED_IMAGE_EXTENSIONS,
  ACCEPTED_IMAGE_TYPES,
  type CaptureMode,
  type PhotoScaleSource,
  photoScaleSourceFromCaptureMode,
  withCaptureMode,
} from "@/lib/shape-studio/types";
import { useCaptureSessionPoll } from "@/lib/shape-studio/use-capture-session-poll";
import { QrCapturePanel } from "./qr-capture-panel";

type HandPhotoPanelProps = {
  onImageSelected: (url: string, source: PhotoScaleSource) => void;
};

export type HandPhotoPanelHandle = {
  openDevicePicker: () => void;
  revealPhonePaths: () => void;
};

type PanelView = "chooser" | "phone";

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

const PATH_CARDS: Array<{
  mode: CaptureMode;
  title: string;
  body: string;
  cta: string;
}> = [
  {
    mode: "known-size",
    title: "I know my ring size",
    body: "Scan for a clean hand photo. Your selected ring size helps guide the preview.",
    cta: "Create QR",
  },
  {
    mode: "card-scale",
    title: "I don’t know my ring size",
    body: "Use a standard-size card to scale the diamond preview to your photo. Final ring size should still be confirmed by a jeweler. Use a blank gift card, hotel key, or standard-size loyalty card. Avoid cards showing personal or financial information.",
    cta: "Create QR",
  },
];

export const HandPhotoPanel = forwardRef<
  HandPhotoPanelHandle,
  HandPhotoPanelProps
>(function HandPhotoPanel({ onImageSelected }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const creatingRef = useRef(false);
  const captureModeRef = useRef<CaptureMode | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [view, setView] = useState<PanelView>("chooser");
  const [captureMode, setCaptureMode] = useState<CaptureMode | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [captureUrl, setCaptureUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrExpired, setQrExpired] = useState(false);
  const [phoneWaiting, setPhoneWaiting] = useState(false);

  const pulsePanel = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    el.classList.remove("is-start-focus");
    void el.offsetWidth;
    el.classList.add("is-start-focus");
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    window.setTimeout(() => el.classList.remove("is-start-focus"), 1600);
  }, []);

  const resetPhoneCapture = useCallback(() => {
    creatingRef.current = false;
    captureModeRef.current = null;
    setView("chooser");
    setCaptureMode(null);
    setSessionId(null);
    setCaptureUrl(null);
    setExpiresAt(null);
    setQrError(null);
    setQrExpired(false);
    setPhoneWaiting(false);
    setCreatingSession(false);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      openDevicePicker: () => {
        if (view !== "chooser") resetPhoneCapture();
        pulsePanel();
        window.setTimeout(() => inputRef.current?.click(), 120);
      },
      revealPhonePaths: () => {
        if (view !== "chooser") resetPhoneCapture();
        pulsePanel();
        window.setTimeout(() => {
          panelRef.current
            ?.querySelector<HTMLElement>(".dss-capture-path-list")
            ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }, 80);
      },
    }),
    [pulsePanel, resetPhoneCapture, view],
  );

  const handleImageFromDevice = useCallback(
    (file: File | null | undefined) => {
      if (!file || !isAcceptedFile(file)) return;
      resetPhoneCapture();
      const url = URL.createObjectURL(file);
      onImageSelected(url, "upload");
    },
    [onImageSelected, resetPhoneCapture],
  );

  const handleImageFromPhone = useCallback(
    (url: string) => {
      const mode = captureModeRef.current ?? "known-size";
      const source: PhotoScaleSource = photoScaleSourceFromCaptureMode(mode);
      setPhoneWaiting(false);
      resetPhoneCapture();
      onImageSelected(url, source);
    },
    [onImageSelected, resetPhoneCapture],
  );

  useCaptureSessionPoll({
    sessionId,
    enabled: view === "phone" && Boolean(sessionId) && !qrExpired,
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

  const startPhoneCapture = useCallback(async (mode: CaptureMode) => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setView("phone");
    captureModeRef.current = mode;
    setCaptureMode(mode);
    setCreatingSession(true);
    setQrError(null);
    setQrExpired(false);
    setPhoneWaiting(false);
    setSessionId(null);
    setCaptureUrl(null);
    setExpiresAt(null);

    try {
      const res = await fetch("/api/shape-studio/sessions", { method: "POST" });
      const body = (await res.json()) as {
        sessionId?: string;
        captureUrl?: string;
        expiresAt?: string;
        message?: string;
      };

      if (!res.ok || !body.captureUrl) {
        const message =
          body.message ??
          "Phone capture is unavailable. Upload from this device instead.";
        resetPhoneCapture();
        setQrError(message);
        return;
      }

      setSessionId(body.sessionId ?? null);
      setCaptureUrl(withCaptureMode(body.captureUrl, mode));
      setExpiresAt(body.expiresAt ?? null);
      setPhoneWaiting(true);
    } catch {
      resetPhoneCapture();
      setQrError("Could not start phone capture. Try again or upload locally.");
    } finally {
      setCreatingSession(false);
      creatingRef.current = false;
    }
  }, [resetPhoneCapture]);

  return (
    <section
      ref={panelRef}
      className="dss-card"
      aria-label="Hand photo"
    >
      <div className="dss-card-head">Hand Photo</div>

      {view === "chooser" ? (
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
            <p>This device — drag and drop, or choose a file.</p>
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

          <p className="dss-capture-path-label">Or capture from your phone</p>

          <div className="dss-capture-path-list">
            {PATH_CARDS.map((card) => (
              <div key={card.mode} className="dss-capture-path">
                <div className="dss-capture-path-copy">
                  <p className="dss-capture-path-title">{card.title}</p>
                  <p className="dss-capture-path-body">{card.body}</p>
                </div>
                <button
                  type="button"
                  className="dss-capture-path-cta"
                  disabled={creatingSession}
                  onClick={() => void startPhoneCapture(card.mode)}
                >
                  {card.cta}
                </button>
              </div>
            ))}
          </div>

          {qrError ? (
            <p className="dss-qr-message dss-qr-message--warn">{qrError}</p>
          ) : null}
        </>
      ) : creatingSession ? (
        <p className="dss-qr-loading">Preparing QR capture session…</p>
      ) : captureUrl && expiresAt && captureMode ? (
        <QrCapturePanel
          captureUrl={captureUrl}
          captureMode={captureMode}
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
});
