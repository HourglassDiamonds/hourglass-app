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
 * Post-photo rail card only. Pre-photo capture/QR lives in the centered stage.
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
    <section className="dss-card" aria-label="Scaled Preview photo">
      <div className="dss-card-head">Photo</div>
      <p className="dss-scaled-photo-status">Hand-and-card photo ready</p>
      <button
        type="button"
        className="dss-guide-btn dss-guide-btn--quiet"
        onClick={onStartOver}
      >
        Start over
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        capture="environment"
        className="sr-only"
        onChange={(e) => handleImageFromDevice(e.target.files?.[0])}
      />
    </section>
  );
});
