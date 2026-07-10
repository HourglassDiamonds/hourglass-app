/**
 * Scaled Preview capture-session lifecycle.
 *
 * Valid transitions:
 *   pending → image_uploaded | cancelled | expired
 *   image_uploaded → consumed | cancelled | expired
 *
 * Terminal: consumed, cancelled, expired
 */
export type ShapeStudioSessionStatus =
  | "pending"
  | "image_uploaded"
  | "consumed"
  | "cancelled"
  | "expired";

export type ShapeStudioSessionRecord = {
  sessionId: string;
  status: ShapeStudioSessionStatus;
  imagePath: string | null;
  imageMime: string | null;
  createdAt: string;
  expiresAt: string;
  acknowledgedAt?: string | null;
};

export type CreateSessionResult = {
  sessionId: string;
  capturePath: string;
  expiresAt: string;
};

export type SessionPollResult = {
  sessionId: string;
  status: ShapeStudioSessionStatus;
  expiresAt: string;
  imageUrl?: string;
  acknowledgedAt?: string;
};

/** Capture-page / upload gate — never expose raw session IDs in UI copy. */
export type CaptureGateReason =
  | "ok"
  | "not_found"
  | "expired"
  | "cancelled"
  | "consumed"
  | "already_uploaded"
  | "unavailable";

export type CaptureGateResult = {
  allowed: boolean;
  reason: CaptureGateReason;
  status?: ShapeStudioSessionStatus;
  expiresAt?: string;
};
