import type {
  CaptureGateResult,
  SessionPollResult,
  ShapeStudioSessionStatus,
} from "./session-types";

const TERMINAL: ReadonlySet<ShapeStudioSessionStatus> = new Set([
  "consumed",
  "cancelled",
  "expired",
]);

export function isTerminalSessionStatus(
  status: ShapeStudioSessionStatus,
): boolean {
  return TERMINAL.has(status);
}

export function canAcceptUpload(status: ShapeStudioSessionStatus): boolean {
  return status === "pending";
}

export function canAcknowledge(status: ShapeStudioSessionStatus): boolean {
  return status === "image_uploaded" || status === "consumed";
}

export function canCancel(status: ShapeStudioSessionStatus): boolean {
  return status === "pending" || status === "image_uploaded" || status === "cancelled";
}

/**
 * Evaluate whether the capture page may enable the file input.
 * `already_uploaded` blocks a second capture but the phone may wait for ack.
 */
export function evaluateCaptureGate(
  session: SessionPollResult | null | undefined,
  options?: { nowMs?: number },
): CaptureGateResult {
  if (!session) {
    return { allowed: false, reason: "not_found" };
  }

  const nowMs = options?.nowMs ?? Date.now();
  const pastExpiry = Date.parse(session.expiresAt) <= nowMs;

  if (session.status === "cancelled") {
    return {
      allowed: false,
      reason: "cancelled",
      status: session.status,
      expiresAt: session.expiresAt,
    };
  }

  if (session.status === "expired" || (session.status === "pending" && pastExpiry)) {
    return {
      allowed: false,
      reason: "expired",
      status: "expired",
      expiresAt: session.expiresAt,
    };
  }

  if (session.status === "consumed") {
    return {
      allowed: false,
      reason: "consumed",
      status: session.status,
      expiresAt: session.expiresAt,
    };
  }

  if (session.status === "image_uploaded") {
    if (pastExpiry) {
      return {
        allowed: false,
        reason: "expired",
        status: "expired",
        expiresAt: session.expiresAt,
      };
    }
    return {
      allowed: false,
      reason: "already_uploaded",
      status: session.status,
      expiresAt: session.expiresAt,
    };
  }

  if (session.status === "pending") {
    return {
      allowed: true,
      reason: "ok",
      status: session.status,
      expiresAt: session.expiresAt,
    };
  }

  return { allowed: false, reason: "unavailable", status: session.status };
}

export function captureGateUserMessage(reason: CaptureGateResult["reason"]): string {
  switch (reason) {
    case "not_found":
      return "This capture link is not valid. Return to Scaled Preview on your computer and create a new capture session.";
    case "expired":
    case "cancelled":
      return "This capture session has ended. Return to Scaled Preview on your computer and create a new one.";
    case "consumed":
      return "This photograph was already received on your computer.";
    case "already_uploaded":
      return "A photograph was already uploaded for this session.";
    case "unavailable":
      return "Phone capture is unavailable. Return to Scaled Preview on your computer and try again.";
    case "ok":
      return "";
  }
}

/** True when poll metadata alone must NOT imply delivery or deletion. */
export function pollIndicatesImageReady(session: SessionPollResult): boolean {
  return session.status === "image_uploaded" && Boolean(session.imageUrl);
}

export function pollIndicatesDelivered(session: SessionPollResult): boolean {
  return session.status === "consumed";
}

export function pollIndicatesEnded(session: SessionPollResult): boolean {
  return session.status === "cancelled" || session.status === "expired";
}
