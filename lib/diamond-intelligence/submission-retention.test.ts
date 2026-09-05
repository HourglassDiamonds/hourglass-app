import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DI_SUBMISSION_CLEANUP_BATCH_SIZE,
  DI_SUBMISSION_RETENTION_DAYS,
  DI_SUBMISSION_RETENTION_POLICY,
  computeDiSubmissionExpiry,
  diSubmissionExpiryCutoff,
  isDiSubmissionExpired,
  isMissingStorageObjectError,
  runDiSubmissionCleanup,
  type DiSubmissionCleanupCandidate,
} from "./submission-retention";
import {
  buildDiamondIntelligenceArchiveRecord,
  insertDiamondIntelligenceArchiveWithCompensation,
} from "./submission-archive";

describe("DI submission retention constants", () => {
  it("uses a single 30-day retention policy", () => {
    assert.equal(DI_SUBMISSION_RETENTION_DAYS, 30);
    assert.equal(DI_SUBMISSION_RETENTION_POLICY, "30_days");
    assert.equal(DI_SUBMISSION_CLEANUP_BATCH_SIZE, 100);
  });

  it("marks submissions older than 30 days as expired", () => {
    const now = Date.parse("2026-07-22T12:00:00.000Z");
    const older = new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(isDiSubmissionExpired(older, now), true);
  });

  it("retains submissions younger than 30 days", () => {
    const now = Date.parse("2026-07-22T12:00:00.000Z");
    const younger = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(isDiSubmissionExpired(younger, now), false);
  });

  it("treats legacy indefinite rows as eligible based on created_at only", () => {
    const now = Date.parse("2026-07-22T12:00:00.000Z");
    const legacyCreatedAt = new Date(
      now - 45 * 24 * 60 * 60 * 1000,
    ).toISOString();
    // Policy string is intentionally unused — eligibility is timestamp-only.
    assert.equal(isDiSubmissionExpired(legacyCreatedAt, now), true);
    assert.ok(diSubmissionExpiryCutoff(now) > legacyCreatedAt);
  });

  it("computes expiry from creation timestamp", () => {
    const created = "2026-06-01T00:00:00.000Z";
    const expiry = computeDiSubmissionExpiry(created);
    assert.equal(expiry, "2026-07-01T00:00:00.000Z");
  });
});

describe("new archive retention metadata", () => {
  it("sets 30_days policy and expiry timestamps on new archives", () => {
    const before = Date.now();
    const record = buildDiamondIntelligenceArchiveRecord({
      httpStatus: 400,
      earlyFailure: {
        reason: "missing_file",
        message: "No file provided",
      },
    });
    const after = Date.now();

    assert.equal(record.metadataRetentionPolicy, "30_days");
    assert.ok(record.uploadExpiresAt);
    assert.ok(record.ocrTextExpiresAt);
    assert.equal(record.uploadExpiresAt, record.ocrTextExpiresAt);

    const expiresMs = Date.parse(record.uploadExpiresAt!);
    assert.ok(expiresMs >= before + 30 * 24 * 60 * 60 * 1000 - 1000);
    assert.ok(expiresMs <= after + 30 * 24 * 60 * 60 * 1000 + 1000);
  });
});

describe("runDiSubmissionCleanup", () => {
  it("deletes storage before deleting the row", async () => {
    const order: string[] = [];
    const candidates: DiSubmissionCleanupCandidate[] = [
      {
        id: "row-1",
        filePath: "row-1/original.pdf",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const result = await runDiSubmissionCleanup({
      nowMs: Date.parse("2026-07-22T00:00:00.000Z"),
      listExpired: async () => candidates,
      deleteStorageObject: async () => {
        order.push("storage");
        return "deleted";
      },
      deleteRow: async () => {
        order.push("row");
      },
    });

    assert.deepEqual(order, ["storage", "row"]);
    assert.equal(result.storageDeleted, 1);
    assert.equal(result.rowsDeleted, 1);
    assert.equal(result.failed, 0);
  });

  it("treats a missing storage object as idempotent and still deletes the row", async () => {
    const result = await runDiSubmissionCleanup({
      nowMs: Date.parse("2026-07-22T00:00:00.000Z"),
      listExpired: async () => [
        {
          id: "row-missing",
          filePath: "gone/original.pdf",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      deleteStorageObject: async () => "already_missing",
      deleteRow: async () => undefined,
    });

    assert.equal(result.alreadyMissing, 1);
    assert.equal(result.storageDeleted, 0);
    assert.equal(result.rowsDeleted, 1);
    assert.equal(result.failed, 0);
  });

  it("retains the row when storage deletion fails", async () => {
    let rowDeleted = false;
    const result = await runDiSubmissionCleanup({
      nowMs: Date.parse("2026-07-22T00:00:00.000Z"),
      listExpired: async () => [
        {
          id: "row-keep",
          filePath: "row-keep/original.pdf",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      deleteStorageObject: async () => {
        throw new Error("storage unavailable");
      },
      deleteRow: async () => {
        rowDeleted = true;
      },
    });

    assert.equal(rowDeleted, false);
    assert.equal(result.rowsDeleted, 0);
    assert.equal(result.failed, 1);
  });

  it("bounds the cleanup batch", async () => {
    let requestedLimit: number | undefined;
    await runDiSubmissionCleanup({
      nowMs: Date.parse("2026-07-22T00:00:00.000Z"),
      listExpired: async (_cutoff, limit) => {
        requestedLimit = limit;
        return [];
      },
      deleteStorageObject: async () => "deleted",
      deleteRow: async () => undefined,
    });

    assert.equal(requestedLimit, DI_SUBMISSION_CLEANUP_BATCH_SIZE);
  });

  it("returns aggregate counts only", async () => {
    const result = await runDiSubmissionCleanup({
      nowMs: Date.parse("2026-07-22T00:00:00.000Z"),
      listExpired: async () => [
        {
          id: "secret-id",
          filePath: "secret-path/report.pdf",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      deleteStorageObject: async () => "deleted",
      deleteRow: async () => undefined,
    });

    const keys = Object.keys(result).sort();
    assert.deepEqual(keys, [
      "alreadyMissing",
      "expired",
      "failed",
      "rowsDeleted",
      "scanned",
      "storageDeleted",
    ]);
    assert.equal(
      JSON.stringify(result).includes("secret-id"),
      false,
    );
    assert.equal(
      JSON.stringify(result).includes("secret-path"),
      false,
    );
  });

  it("is idempotent when storage is already gone", async () => {
    let deletes = 0;
    const deps = {
      nowMs: Date.parse("2026-07-22T00:00:00.000Z"),
      listExpired: async () =>
        deletes === 0
          ? [
              {
                id: "row-once",
                filePath: "row-once/original.pdf",
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            ]
          : [],
      deleteStorageObject: async () => {
        deletes += 1;
        return "already_missing" as const;
      },
      deleteRow: async () => undefined,
    };

    const first = await runDiSubmissionCleanup(deps);
    const second = await runDiSubmissionCleanup(deps);

    assert.equal(first.rowsDeleted, 1);
    assert.equal(first.alreadyMissing, 1);
    assert.equal(second.scanned, 0);
    assert.equal(second.rowsDeleted, 0);
    assert.equal(second.failed, 0);
  });
});

describe("isMissingStorageObjectError", () => {
  it("recognizes common missing-object messages", () => {
    assert.equal(isMissingStorageObjectError("Object not found"), true);
    assert.equal(isMissingStorageObjectError("404 Not Found"), true);
    assert.equal(isMissingStorageObjectError("permission denied"), false);
  });
});

describe("insertDiamondIntelligenceArchiveWithCompensation", () => {
  it("deletes uploaded storage when row insert fails and preserves the insert error", async () => {
    const deletedPaths: string[] = [];
    const insertError = new Error("DI archive insert failed: simulated_insert");
    const objectPath =
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/original.pdf";
    const logs: unknown[][] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      logs.push(args);
    };

    try {
      await assert.rejects(
        () =>
          insertDiamondIntelligenceArchiveWithCompensation({
            record: buildDiamondIntelligenceArchiveRecord({
              httpStatus: 400,
              earlyFailure: {
                reason: "missing_file",
                message: "No file provided",
              },
            }),
            uploadedObjectPath: objectPath,
            insertRow: async () => {
              throw insertError;
            },
            deleteObject: async (path) => {
              deletedPaths.push(path);
              return "deleted";
            },
          }),
        (err: unknown) => err === insertError,
      );
    } finally {
      console.error = originalError;
    }

    assert.deepEqual(deletedPaths, [objectPath]);
    const serialized = JSON.stringify(logs);
    assert.equal(serialized.includes(objectPath), false);
    assert.equal(serialized.includes("original.pdf"), false);
  });

  it("does not compensate when row insert succeeds", async () => {
    let deleteCalled = false;
    const id = await insertDiamondIntelligenceArchiveWithCompensation({
      record: buildDiamondIntelligenceArchiveRecord({
        httpStatus: 200,
      }),
      uploadedObjectPath: "keep/original.pdf",
      insertRow: async () => "row-ok",
      deleteObject: async () => {
        deleteCalled = true;
        return "deleted";
      },
    });

    assert.equal(id, "row-ok");
    assert.equal(deleteCalled, false);
  });

  it("logs only a generic message when compensating deletion fails", async () => {
    const insertError = new Error("DI archive insert failed: simulated_insert");
    const objectPath = "customer-report-999/secret-name.pdf";
    const logs: unknown[][] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      logs.push(args);
    };

    try {
      await assert.rejects(
        () =>
          insertDiamondIntelligenceArchiveWithCompensation({
            record: buildDiamondIntelligenceArchiveRecord({
              httpStatus: 400,
              earlyFailure: {
                reason: "missing_file",
                message: "No file provided",
              },
            }),
            uploadedObjectPath: objectPath,
            insertRow: async () => {
              throw insertError;
            },
            deleteObject: async () => {
              throw new Error(`delete blew up for ${objectPath}`);
            },
          }),
        (err: unknown) => err === insertError,
      );
    } finally {
      console.error = originalError;
    }

    assert.equal(logs.length, 1);
    assert.deepEqual(logs[0], [
      "[di-submission-archive]",
      "compensating_storage_delete_failed",
    ]);
    const serialized = JSON.stringify(logs);
    assert.equal(serialized.includes(objectPath), false);
    assert.equal(serialized.includes("secret-name"), false);
    assert.equal(serialized.includes("customer-report"), false);
  });
});
