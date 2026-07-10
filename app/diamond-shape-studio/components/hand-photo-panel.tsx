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
  withCaptureMode,
} from "@/lib/shape-studio/types";
import { useCaptureSessionPoll } from "@/lib/shape-studio/use-capture-session-poll";
import { QrCapturePanel } from "./qr-capture-panel";

type HandPhotoPanelProps = {
  onImageSelected: (url: string) => void;
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
    body: "Scan for a clean hand photo. Visual preview only — not a final sizing measurement.",
    cta: "Create QR",
  },
  {
    mode: "card-scale",
    title: "I do not know my ring size",
    body: "Scan with a standard card in frame. Visual preview only — not a final sizing measurement.",
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

  useImperativeHandle(
    ref,
    () => ({
      openDevicePicker: () => {
        if (view !== "chooser") {
          creatingRef.current = false;
          setView("chooser");
          setCaptureMode(null);
          setSessionId(null);
          setCaptureUrl(null);
          setExpiresAt(null);
          setQrError(null);
          setQrExpired(false);
          setPhoneWaiting(false);
          setCreatingSession(false);
        }
        pulsePanel();
        window.setTimeout(() => inputRef.current?.click(), 120);
      },
      revealPhonePaths: () => {
        if (view !== "chooser") {
          creatingRef.current = false;
          setView("chooser");
          setCaptureMode(null);
          setSessionId(null);
          setCaptureUrl(null);
          setExpiresAt(null);
          setQrError(null);
          setQrExpired(false);
          setPhoneWaiting(false);
          setCreatingSession(false);
        }
        pulsePanel();
        window.setTimeout(() => {
          panelRef.current
            ?.querySelector<HTMLElement>(".dss-capture-path-list")
            ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }, 80);
      },
    }),
    [pulsePanel, view],
  );

  const resetPhoneCapture = useCallback(() => {
    creatingRef.current = false;
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
        setQrError(
          body.message ??
            "Phone capture is unavailable. Upload from this device instead.",
        );
        creatingRef.current = false;
        setView("chooser");
        setCaptureMode(null);
        return;
      }

      setSessionId(body.sessionId ?? null);
      setCaptureUrl(withCaptureMode(body.captureUrl, mode));
      setExpiresAt(body.expiresAt ?? null);
      setPhoneWaiting(true);
    } catch {
      setQrError("Could not start phone capture. Try again or upload locally.");
      creatingRef.current = false;
      setView("chooser");
      setCaptureMode(null);
    } finally {
      setCreatingSession(false);
      creatingRef.current = false;
    }
  }, []);

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
