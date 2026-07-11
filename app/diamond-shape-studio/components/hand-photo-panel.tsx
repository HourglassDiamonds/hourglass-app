"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_IMAGE_EXTENSIONS,
} from "@/lib/shape-studio/types";

export type MarkCardPhotoActions = {
  onSetPhotoScale: () => void;
  onResetPoints: () => void;
  cardEdgeOk: boolean;
};

type HandPhotoPanelProps = {
  onImageSelected: (url: string, source: "card-reference") => void;
  /** Authoritative reset — returns to capture entry (QR on desktop, local on phone). */
  onStartOver: () => void;
  /**
   * Mobile mark-card calibration actions — rendered in this card (not the
   * top stage guide row) so they stay below the image and fully tappable.
   */
  markCardActions?: MarkCardPhotoActions | null;
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
>(function HandPhotoPanel(
  { onImageSelected, onStartOver, markCardActions = null },
  ref,
) {
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
      aria-label="Scaled Preview photo"
      data-dss-photo-card
    >
      <div className="dss-card-head">Photo</div>
      <p className="dss-scaled-photo-status">Hand-and-card photo ready</p>
      {markCardActions ? (
        <div
          className="dss-photo-card-actions"
          data-dss-photo-card-actions
          role="group"
          aria-label="Photo calibration actions"
        >
          <div className="dss-photo-card-actions-row">
            <button
              type="button"
              className="dss-guide-btn"
              data-dss-photo-action="set-photo-scale"
              disabled={!markCardActions.cardEdgeOk}
              onClick={markCardActions.onSetPhotoScale}
            >
              Set photo scale
            </button>
            <button
              type="button"
              className="dss-guide-btn dss-guide-btn--quiet"
              data-dss-photo-action="reset-points"
              onClick={markCardActions.onResetPoints}
            >
              Reset points
            </button>
          </div>
          {!markCardActions.cardEdgeOk ? (
            <p className="dss-guide-warn dss-photo-card-warn">
              Move the points farther apart along the card’s long edge.
            </p>
          ) : null}
          <button
            type="button"
            className="dss-guide-btn dss-guide-btn--quiet dss-photo-card-start-over"
            data-dss-photo-action="start-over"
            onClick={onStartOver}
          >
            Start over
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="dss-guide-btn dss-guide-btn--quiet"
          data-dss-photo-action="start-over"
          onClick={onStartOver}
        >
          Start over
        </button>
      )}
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
