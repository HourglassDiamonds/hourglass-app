import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  captureGateUserMessage,
  canAcceptUpload,
  canAcknowledge,
  canCancel,
  evaluateCaptureGate,
  isTerminalSessionStatus,
  pollIndicatesDelivered,
  pollIndicatesEnded,
  pollIndicatesImageReady,
} from "./session-lifecycle";
import type { SessionPollResult } from "./session-types";
import {
  isPathInsideTrustedCapturePrefix,
  trustedCapturePrefix,
} from "./session-capture-delete";
import { isValidSessionId } from "./session-id";

const SESSION = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

function poll(
  partial: Partial<SessionPollResult> & Pick<SessionPollResult, "status">,
): SessionPollResult {
  return {
    sessionId: SESSION,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ...partial,
  };
}

describe("shape-studio session id", () => {
  it("accepts uuid v4-shaped ids", () => {
    assert.equal(isValidSessionId(SESSION), true);
  });

  it("rejects malformed ids", () => {
    assert.equal(isValidSessionId("not-a-uuid"), false);
    assert.equal(isValidSessionId(""), false);
  });
});

describe("shape-studio capture gate", () => {
  it("rejects unknown session", () => {
    const gate = evaluateCaptureGate(null);
    assert.equal(gate.allowed, false);
    assert.equal(gate.reason, "not_found");
    assert.match(captureGateUserMessage(gate.reason), /not valid/i);
  });

  it("rejects expired pending session", () => {
    const gate = evaluateCaptureGate(
      poll({
        status: "pending",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    );
    assert.equal(gate.allowed, false);
    assert.equal(gate.reason, "expired");
  });

  it("rejects cancelled session", () => {
    const gate = evaluateCaptureGate(poll({ status: "cancelled" }));
    assert.equal(gate.allowed, false);
    assert.equal(gate.reason, "cancelled");
  });

  it("rejects consumed session", () => {
    const gate = evaluateCaptureGate(poll({ status: "consumed" }));
    assert.equal(gate.allowed, false);
    assert.equal(gate.reason, "consumed");
  });

  it("rejects already-uploaded session for a second capture", () => {
    const gate = evaluateCaptureGate(poll({ status: "image_uploaded" }));
    assert.equal(gate.allowed, false);
    assert.equal(gate.reason, "already_uploaded");
  });

  it("allows pending unexpired session", () => {
    const gate = evaluateCaptureGate(poll({ status: "pending" }));
    assert.equal(gate.allowed, true);
    assert.equal(gate.reason, "ok");
  });
});

describe("shape-studio lifecycle transitions", () => {
  it("only pending accepts upload", () => {
    assert.equal(canAcceptUpload("pending"), true);
    assert.equal(canAcceptUpload("image_uploaded"), false);
    assert.equal(canAcceptUpload("cancelled"), false);
    assert.equal(canAcceptUpload("consumed"), false);
    assert.equal(canAcceptUpload("expired"), false);
  });

  it("acknowledge only from image_uploaded or consumed (idempotent)", () => {
    assert.equal(canAcknowledge("image_uploaded"), true);
    assert.equal(canAcknowledge("consumed"), true);
    assert.equal(canAcknowledge("pending"), false);
  });

  it("cancel allowed from pending or uploaded", () => {
    assert.equal(canCancel("pending"), true);
    assert.equal(canCancel("image_uploaded"), true);
    assert.equal(canCancel("cancelled"), true);
  });

  it("marks terminal statuses", () => {
    assert.equal(isTerminalSessionStatus("consumed"), true);
    assert.equal(isTerminalSessionStatus("cancelled"), true);
    assert.equal(isTerminalSessionStatus("expired"), true);
    assert.equal(isTerminalSessionStatus("pending"), false);
  });
});

describe("shape-studio poll semantics", () => {
  it("image_uploaded + url is ready metadata, not delivered", () => {
    const session = poll({
      status: "image_uploaded",
      imageUrl: "https://example.invalid/signed",
    });
    assert.equal(pollIndicatesImageReady(session), true);
    assert.equal(pollIndicatesDelivered(session), false);
  });

  it("poll alone does not mark consumed", () => {
    const session = poll({
      status: "image_uploaded",
      imageUrl: "https://example.invalid/signed",
    });
    assert.notEqual(session.status, "consumed");
  });

  it("consumed is the only delivered signal", () => {
    assert.equal(
      pollIndicatesDelivered(poll({ status: "consumed" })),
      true,
    );
  });

  it("cancelled and expired end the phone wait", () => {
    assert.equal(pollIndicatesEnded(poll({ status: "cancelled" })), true);
    assert.equal(pollIndicatesEnded(poll({ status: "expired" })), true);
  });
});

describe("shape-studio trusted capture prefix", () => {
  it("derives session-scoped prefix", () => {
    assert.equal(trustedCapturePrefix(SESSION), `${SESSION}/`);
  });

  it("rejects paths outside the session prefix", () => {
    assert.equal(
      isPathInsideTrustedCapturePrefix(SESSION, `${SESSION}/capture.jpg`),
      true,
    );
    assert.equal(
      isPathInsideTrustedCapturePrefix(
        SESSION,
        "other-session/capture.jpg",
      ),
      false,
    );
    assert.equal(
      isPathInsideTrustedCapturePrefix(SESSION, `${SESSION}/../evil.jpg`),
      false,
    );
  });

  it("rejects invalid session ids for prefix derivation", () => {
    assert.throws(() => trustedCapturePrefix("nope"));
  });
});
