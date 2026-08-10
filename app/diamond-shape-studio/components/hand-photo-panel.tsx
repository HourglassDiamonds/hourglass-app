"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_IMAGE_EXTENSIONS,
} from "@/lib/shape-studio/types";

type HandPhotoPanelProps = {
  onImageSelected: (url: string, source: "card-reference") => void;
  /** Authoritative reset — returns to capture entry (QR on desktop, local on phone). */
  onStartOver: () => void;
};

export type HandPhotoPanelHandle = {
  openDevicePicker: () => void;
};

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

/**
 * Desktop post-photo rail card. Mobile folds Start Over into step actions
 * and omits this status card during calibration / final preview.
 */
export const HandPhotoPanel = forwardRef<
  HandPhotoPanelHandle,
  HandPhotoPanelProps
>(function HandPhotoPanel({ onImageSelected, onStartOver }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    openDevicePicker: () => {
      inputRef.current?.click();
    },
  }));

  const handleImageFromDevice = useCallback(
    (file: File | null | undefined) => {
      if (!file || !isAcceptedFile(file)) return;
      const url = URL.createObjectURL(file);
      onImageSelected(url, "card-reference");
    },
    [onImageSelected],
  );

  return (
    <section
      className="dss-card"
      aria-label="See It On Your Hand photo"
      data-dss-photo-card
    >
      <div className="dss-card-head">Photo</div>
      <p className="dss-scaled-photo-status">Hand-and-card photo ready</p>
      <button
        type="button"
        className="dss-guide-btn dss-guide-btn--quiet"
        data-dss-photo-action="start-over"
        onClick={onStartOver}
      >
        Start over
      </button>
      {/* P0-4 (WCAG 2.4.7/2.1) — programmatic hook only (openDevicePicker),
          mirroring direct-mobile-entry. Without aria-hidden/tabIndex=-1 this
          invisible input was a focusable keyboard stop with no visible focus.
          Visible upload paths (QR flow, same-device entry) are unaffected. */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        capture="environment"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => handleImageFromDevice(e.target.files?.[0])}
      />
    </section>
  );
});
