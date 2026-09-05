"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { trackDiamondStudioEvent } from "@/app/diamond-studio/analytics";
import type { DiamondStudioEventProperties } from "@/app/diamond-studio/analytics";
import { getAttributionSnapshot } from "@/lib/attribution";
import type { DiamondStudioConfiguration } from "@/lib/diamond-studio/configuration";
import {
  buildSnapshotRequestPath,
  snapshotDownloadFilename,
} from "@/lib/diamond-studio/configuration";

type ShareStudioViewProps = {
  /** Fully resolved absolute or same-origin URL to copy. */
  getShareUrl: () => string;
  analyticsProps: () => DiamondStudioEventProperties;
  configuration: DiamondStudioConfiguration;
  className?: string;
};

type MenuStatus =
  | "idle"
  | "working"
  | "copied"
  | "saved"
  | "shared"
  | "sent"
  | "error";

function canShareFiles(file: File): boolean {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (typeof navigator.share !== "function") return false;
  if (typeof nav.canShare !== "function") return true;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

async function fetchBrandedShareCard(
  configuration: DiamondStudioConfiguration,
): Promise<Blob> {
  const path = buildSnapshotRequestPath(configuration, "card");
  const res = await fetch(path, { method: "GET" });
  if (!res.ok) {
    throw new Error(`snapshot_${res.status}`);
  }
  return res.blob();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

export default function ShareStudioView({
  getShareUrl,
  analyticsProps,
  configuration,
  className = "",
}: ShareStudioViewProps) {
  const menuId = useId();
  const emailFieldId = useId();
  const nameFieldId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [emailPanel, setEmailPanel] = useState(false);
  const [status, setStatus] = useState<MenuStatus>("idle");
  const [emailSending, setEmailSending] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleReset = useCallback((next: MenuStatus) => {
    setStatus(next);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setStatus("idle");
      resetTimer.current = null;
    }, 2200);
  }, []);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const copyStudioLink = useCallback(async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      trackDiamondStudioEvent("diamond_studio_share", analyticsProps());
      scheduleReset("copied");
    } catch {
      scheduleReset("error");
    }
  }, [analyticsProps, getShareUrl, scheduleReset]);

  const shareImage = useCallback(async () => {
    setStatus("working");
    try {
      const blob = await fetchBrandedShareCard(configuration);
      const filename = snapshotDownloadFilename(configuration, "card");
      const file = new File([blob], filename, {
        type: blob.type || "image/jpeg",
      });
      trackDiamondStudioEvent("studio_share_card_created", {
        ...analyticsProps(),
        snapshotVariant: "card",
      });

      if (canShareFiles(file)) {
        try {
          await navigator.share({
            files: [file],
            title: "Hourglass Diamond Studio",
          });
          trackDiamondStudioEvent("studio_snapshot_shared", {
            ...analyticsProps(),
            snapshotVariant: "card",
            shareMethod: "web_share",
          });
          scheduleReset("shared");
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            setStatus("idle");
            return;
          }
        }
      }

      triggerDownload(blob, filename);
      trackDiamondStudioEvent("studio_snapshot_shared", {
        ...analyticsProps(),
        snapshotVariant: "card",
        shareMethod: "download",
      });
      scheduleReset("saved");
    } catch {
      scheduleReset("error");
    }
  }, [analyticsProps, configuration, scheduleReset]);

  const emailThisView = useCallback(async () => {
    setEmailError(null);
    setEmailSending(true);
    try {
      const response = await fetch("/api/diamond-studio/email-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName: firstName.trim() || undefined,
          company_website: honeypot,
          configuration,
          attribution: getAttributionSnapshot(),
        }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        accepted?: boolean;
        message?: string;
      };
      if (!response.ok || !body.ok) {
        setEmailError(body.message || "Couldn’t send. Try again.");
        return;
      }
      if (body.accepted) {
        trackDiamondStudioEvent("studio_view_emailed", {
          ...analyticsProps(),
          snapshotVariant: "card",
        });
      }
      scheduleReset("sent");
    } catch {
      setEmailError("Couldn’t send. Try again.");
    } finally {
      setEmailSending(false);
    }
  }, [analyticsProps, configuration, email, firstName, honeypot, scheduleReset]);

  const statusLabel =
    status === "copied"
      ? "Link copied"
      : status === "saved"
        ? "Saved"
        : status === "shared"
          ? "Shared"
          : status === "sent"
            ? "Sent. Check your inbox."
            : status === "working"
              ? "Working…"
              : status === "error"
                ? "Couldn’t share"
                : "Share this view";

  return (
    <div
      ref={rootRef}
      className={`dts-stage-trust dts-share ${className}`.trim()}
    >
      <button
        type="button"
        className="dts-share-view"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {statusLabel}
      </button>
      {open ? (
        <div className="dts-share-menu" id={menuId}>
          <button
            type="button"
            className="dts-share-menu-primary"
            disabled={emailSending}
            onClick={() => setEmailPanel((value) => !value)}
          >
            <span>Email this view</span>
            <span className="dts-share-menu-hint">
              Send the image and configuration to your inbox.
            </span>
          </button>
          {emailPanel ? (
            <form
              className="dts-share-email"
              onSubmit={(event) => {
                event.preventDefault();
                void emailThisView();
              }}
            >
              <label className="dts-share-email-label" htmlFor={emailFieldId}>
                Email address
              </label>
              <input
                id={emailFieldId}
                className="dts-share-email-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                name="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={emailSending}
              />
              <label className="dts-share-email-label" htmlFor={nameFieldId}>
                First name{" "}
                <span className="dts-share-optional">optional</span>
              </label>
              <input
                id={nameFieldId}
                className="dts-share-email-input"
                type="text"
                autoComplete="given-name"
                name="firstName"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                disabled={emailSending}
              />
              <div className="dts-share-honeypot" aria-hidden="true">
                <label htmlFor={`${emailFieldId}-company`}>Company website</label>
                <input
                  id={`${emailFieldId}-company`}
                  type="text"
                  name="company_website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(event) => setHoneypot(event.target.value)}
                />
              </div>
              <button
                type="submit"
                className="dts-share-email-submit"
                disabled={emailSending}
              >
                Send
              </button>
              {emailError ? (
                <p className="dts-share-email-status" role="status">
                  {emailError}
                </p>
              ) : status === "sent" ? (
                <p className="dts-share-email-status" role="status">
                  Sent. Check your inbox.
                </p>
              ) : null}
            </form>
          ) : null}
          <button
            type="button"
            disabled={status === "working"}
            onClick={() => {
              void shareImage();
            }}
          >
            Share image
          </button>
          <button
            type="button"
            disabled={status === "working"}
            onClick={() => {
              void copyStudioLink();
            }}
          >
            Copy Studio link
          </button>
        </div>
      ) : null}
    </div>
  );
}
