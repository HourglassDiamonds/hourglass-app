import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatGmailIntakeRefreshProgress,
  gmailIntakeFreshnessHeadline,
  gmailIntakeRefreshButtonLabel,
  outcomeAfterGmailIntakeRefresh,
} from "./intake-refresh";

describe("Gmail intake index refresh outcomes", () => {
  it("never leaves the founder pending after a disabled, failed, or in-flight result", () => {
    assert.equal(
      outcomeAfterGmailIntakeRefresh({
        enabled: false,
        stopReason: null,
        result: { safeErrorCode: "sync-disabled", completed: false },
      }).message,
      "Gmail index refresh is not activated.",
    );
    assert.equal(
      outcomeAfterGmailIntakeRefresh({
        enabled: true,
        stopReason: "failed",
        result: { safeErrorCode: "sync-disabled", completed: false },
      }).phase,
      "disabled",
    );
    const already = outcomeAfterGmailIntakeRefresh({
      enabled: true,
      stopReason: "failed",
      result: { safeErrorCode: "gmail-sync-already-running", completed: false },
    });
    assert.equal(already.phase, "already-in-progress");
    assert.equal(already.message, "Refresh already in progress");
    assert.equal(already.clearPending, true);
    const failed = outcomeAfterGmailIntakeRefresh({
      enabled: true,
      stopReason: "failed",
      result: { safeErrorCode: "gmail-sync-failed", completed: false },
    });
    assert.equal(failed.phase, "failed");
    assert.equal(failed.message, "Refresh failed — retry");
    assert.equal(failed.clearPending, true);
    const cancelled = outcomeAfterGmailIntakeRefresh({
      enabled: true,
      stopReason: "cancelled",
      result: { safeErrorCode: null, completed: false },
    });
    assert.equal(cancelled.phase, "idle");
    assert.equal(cancelled.clearPending, true);
  });

  it("treats a successful catch-up as current and always clears pending", () => {
    const done = outcomeAfterGmailIntakeRefresh({
      enabled: true,
      stopReason: "completed",
      result: { safeErrorCode: null, completed: true },
    });
    assert.equal(done.phase, "current");
    assert.equal(done.message, null);
    assert.equal(done.clearPending, true);
    assert.equal(gmailIntakeRefreshButtonLabel(true), "Refreshing mail index…");
    assert.equal(gmailIntakeRefreshButtonLabel(false), "Refresh mail index");
    assert.equal(formatGmailIntakeRefreshProgress(0), null);
    assert.equal(
      formatGmailIntakeRefreshProgress(2),
      "Refreshing Gmail index… Processed 2 incremental chunks.",
    );
    assert.equal(
      gmailIntakeFreshnessHeadline({
        current: true,
        updatedLabel: "Sep 8, 2026, 4:18 PM",
      }),
      "INDEX CURRENT · Last updated Sep 8, 2026, 4:18 PM",
    );
    assert.equal(
      gmailIntakeFreshnessHeadline({
        current: false,
        updatedLabel: "Sep 6, 2026, 9:48 AM",
      }),
      "Gmail index last updated: Sep 6, 2026, 9:48 AM",
    );
  });

  it("does not treat concurrent start as a hang", () => {
    const inFlight = outcomeAfterGmailIntakeRefresh({
      enabled: true,
      stopReason: "already-in-flight",
      result: { safeErrorCode: null, completed: false },
    });
    assert.equal(inFlight.phase, "already-in-progress");
    assert.equal(inFlight.clearPending, false);
    assert.equal(inFlight.message, "Refresh already in progress");
  });
});
