import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import {
  LOCAL_PHOTO_ACCEPT,
  LOCAL_PHOTO_INVALID_TYPE_MESSAGE,
  LOCAL_PHOTO_OVERSIZED_MESSAGE,
  DIRECT_MOBILE_ENTRY_MAX_WIDTH_PX,
  replacePendingObjectUrl,
  selectLocalPhotoFile,
} from "./local-photo-selection";
import { SHAPE_STUDIO_MAX_IMAGE_BYTES } from "./validate-image";

describe("local photo selection (same-device mobile entry)", () => {
  const createdUrls: string[] = [];
  let originalCreate: typeof URL.createObjectURL;
  let originalRevoke: typeof URL.revokeObjectURL;
  const revoked: string[] = [];

  before(() => {
    originalCreate = URL.createObjectURL;
    originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = ((blob: Blob) => {
      const url = `blob:test-${createdUrls.length}-${blob.size}`;
      createdUrls.push(url);
      return url;
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = ((url: string) => {
      revoked.push(url);
    }) as typeof URL.revokeObjectURL;
  });

  after(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it("uses the existing 960px layout breakpoint for direct mobile entry", () => {
    assert.equal(DIRECT_MOBILE_ENTRY_MAX_WIDTH_PX, 960);
  });

  it("accepts image/* for native camera and library inputs", () => {
    assert.equal(LOCAL_PHOTO_ACCEPT, "image/*");
  });

  it("treats cancellation (no file) as non-destructive", () => {
    const result = selectLocalPhotoFile(null);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "cancelled");
      assert.equal(result.error, "");
    }
    const before = createdUrls.length;
    selectLocalPhotoFile(undefined);
    assert.equal(createdUrls.length, before);
  });

  it("rejects unsupported types with existing validation copy", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "notes.txt", {
      type: "text/plain",
    });
    const result = selectLocalPhotoFile(file);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "invalid_type");
      assert.equal(result.error, LOCAL_PHOTO_INVALID_TYPE_MESSAGE);
    }
  });

  it("rejects oversized files with the existing 10 MB limit", () => {
    const oversized = new File([new Uint8Array([0xff, 0xd8])], "hand.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(oversized, "size", {
      value: SHAPE_STUDIO_MAX_IMAGE_BYTES + 1,
    });
    const result = selectLocalPhotoFile(oversized);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "oversized");
      assert.equal(result.error, LOCAL_PHOTO_OVERSIZED_MESSAGE);
    }
  });

  it("creates exactly one object URL for a valid JPEG", () => {
    const before = createdUrls.length;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "hand.jpg", {
      type: "image/jpeg",
    });
    const result = selectLocalPhotoFile(file);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.objectUrl.startsWith("blob:"));
      assert.equal(createdUrls.length, before + 1);
    }
  });

  it("revokes the prior pending URL when replacing a selection", () => {
    const first = selectLocalPhotoFile(
      new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" }),
    );
    const second = selectLocalPhotoFile(
      new File([new Uint8Array([2])], "b.jpg", { type: "image/jpeg" }),
    );
    assert.ok(first.ok && second.ok);
    if (!first.ok || !second.ok) return;

    const revokedBefore = revoked.length;
    const next = replacePendingObjectUrl(first.objectUrl, second.objectUrl);
    assert.equal(next, second.objectUrl);
    assert.equal(revoked.length, revokedBefore + 1);
    assert.equal(revoked[revoked.length - 1], first.objectUrl);
  });

  it("revokes the pending URL on retake (clear to null)", () => {
    const selected = selectLocalPhotoFile(
      new File([new Uint8Array([3])], "c.jpg", { type: "image/jpeg" }),
    );
    assert.ok(selected.ok);
    if (!selected.ok) return;

    const revokedBefore = revoked.length;
    const cleared = replacePendingObjectUrl(selected.objectUrl, null);
    assert.equal(cleared, null);
    assert.equal(revoked.length, revokedBefore + 1);
    assert.equal(revoked[revoked.length - 1], selected.objectUrl);
  });

  it("does not revoke when transferring the same URL (confirm ownership)", () => {
    const selected = selectLocalPhotoFile(
      new File([new Uint8Array([4])], "d.jpg", { type: "image/jpeg" }),
    );
    assert.ok(selected.ok);
    if (!selected.ok) return;

    const revokedBefore = revoked.length;
    const kept = replacePendingObjectUrl(
      selected.objectUrl,
      selected.objectUrl,
    );
    assert.equal(kept, selected.objectUrl);
    assert.equal(revoked.length, revokedBefore);
  });
});
