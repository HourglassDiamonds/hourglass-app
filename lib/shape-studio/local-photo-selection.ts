import {
  isAcceptedCaptureFile,
  SHAPE_STUDIO_MAX_IMAGE_BYTES,
} from "./validate-image";

/** Matches Shape Studio layout stack breakpoint (`max-width: 960px`). */
export const DIRECT_MOBILE_ENTRY_MAX_WIDTH_PX = 960;

export const LOCAL_PHOTO_ACCEPT = "image/*";

export const LOCAL_PHOTO_INVALID_TYPE_MESSAGE =
  "Please choose a JPG, PNG, or WEBP image.";

export const LOCAL_PHOTO_OVERSIZED_MESSAGE =
  "That photo is too large. Please choose an image under 10 MB.";

export type LocalPhotoSelectionFailureReason =
  | "cancelled"
  | "invalid_type"
  | "oversized";

export type LocalPhotoSelectionResult =
  | { ok: true; objectUrl: string }
  | {
      ok: false;
      reason: LocalPhotoSelectionFailureReason;
      error: string;
    };

/**
 * Validate a native file-input pick and create a temporary object URL.
 * Cancellation (no file) is not an error — callers should stay on entry.
 */
export function selectLocalPhotoFile(
  file: File | null | undefined,
): LocalPhotoSelectionResult {
  if (!file) {
    return { ok: false, reason: "cancelled", error: "" };
  }

  if (!isAcceptedCaptureFile(file)) {
    return {
      ok: false,
      reason: "invalid_type",
      error: LOCAL_PHOTO_INVALID_TYPE_MESSAGE,
    };
  }

  if (file.size > SHAPE_STUDIO_MAX_IMAGE_BYTES) {
    return {
      ok: false,
      reason: "oversized",
      error: LOCAL_PHOTO_OVERSIZED_MESSAGE,
    };
  }

  return { ok: true, objectUrl: URL.createObjectURL(file) };
}

/** Revoke a prior blob URL when replacing or clearing a pending preview. */
export function replacePendingObjectUrl(
  previous: string | null,
  next: string | null,
): string | null {
  if (previous?.startsWith("blob:") && previous !== next) {
    URL.revokeObjectURL(previous);
  }
  return next;
}
