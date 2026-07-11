"use client";

import { useCallback, useRef, useState } from "react";
import {
  LOCAL_PHOTO_ACCEPT,
  selectLocalPhotoFile,
} from "@/lib/shape-studio/local-photo-selection";

type DirectMobileEntryProps = {
  onPhotoSelected: (objectUrl: string) => void;
  /** Quiet secondary path — starts the existing desktop QR relay when present. */
  onUseAnotherDevice?: () => void;
};

/**
 * Same-device phone entry: native camera capture only.
 * Does not create a capture relay session.
 */
export function DirectMobileEntry({
  onPhotoSelected,
  onUseAnotherDevice,
}: DirectMobileEntryProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const applyFile = useCallback(
    (file: File | null | undefined) => {
      const result = selectLocalPhotoFile(file);
      if (!result.ok) {
        if (result.reason === "cancelled") return;
        setError(result.error);
        return;
      }
      setError(null);
      onPhotoSelected(result.objectUrl);
    },
    [onPhotoSelected],
  );

  return (
    <div className="dss-entry-mobile" data-dss-direct-mobile-entry>
      <p className="dss-stage-empty-kicker">Hand preview</p>
      <p className="dss-stage-empty-title">Photograph your hand</p>
      <p className="dss-stage-empty-copy">
        Photograph your hand with a standard-size card fully visible beside it.
      </p>
      <p className="dss-stage-empty-privacy">
        The card allows the preview to be calibrated accurately.
      </p>
      <div className="dss-stage-empty-actions dss-entry-mobile-actions">
        <button
          type="button"
          className="dss-stage-empty-btn"
          aria-label="Take a photo"
          onClick={() => {
            setError(null);
            cameraInputRef.current?.click();
          }}
        >
          Take a Photo
        </button>
      </div>
      {error ? (
        <p className="dss-entry-local-error" role="alert">
          {error}
        </p>
      ) : null}
      {onUseAnotherDevice ? (
        <button
          type="button"
          className="dss-entry-secondary-link"
          onClick={onUseAnotherDevice}
        >
          Using another device?
        </button>
      ) : null}
      <p className="dss-stage-empty-privacy">
        Use a blank gift card, hotel key, or standard-size loyalty card. Avoid
        cards showing personal or financial information.
      </p>
      <input
        ref={cameraInputRef}
        type="file"
        accept={LOCAL_PHOTO_ACCEPT}
        className="sr-only"
        data-dss-local-input="camera"
        capture="environment"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          applyFile(file);
        }}
      />
    </div>
  );
}

type DirectMobileReviewProps = {
  imageUrl: string;
  onUseThisPhoto: () => void;
  onRetake: () => void;
};

/**
 * Local review gate before card marking. No relay upload or “sent” copy.
 */
export function DirectMobileReview({
  imageUrl,
  onUseThisPhoto,
  onRetake,
}: DirectMobileReviewProps) {
  return (
    <div
      className="dss-entry-review"
      data-dss-direct-mobile-review
      role="region"
      aria-label="Selected photograph review"
    >
      <p className="dss-stage-empty-kicker">Review photo</p>
      <p className="dss-stage-empty-title">Use this photograph?</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Selected hand-and-card photograph"
        className="dss-entry-review-img"
        draggable={false}
      />
      <div className="dss-stage-empty-actions dss-entry-review-actions">
        <button
          type="button"
          className="dss-stage-empty-btn"
          aria-label="Use this photo"
          onClick={onUseThisPhoto}
        >
          Use This Photo
        </button>
        <button
          type="button"
          className="dss-stage-empty-btn dss-stage-empty-btn--quiet"
          aria-label="Retake photo"
          onClick={onRetake}
        >
          Retake
        </button>
      </div>
    </div>
  );
}
