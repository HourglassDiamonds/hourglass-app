import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROJECT_ARTIFACT_GMAIL_SOURCE_REF_MAX,
  PROJECT_ARTIFACT_SOURCE_REF_MAX,
} from "../project-artifacts/types";
import {
  parseArtifactSourceRef,
  projectArtifactSourceRefMax,
} from "../project-artifacts/validate";
import {
  packGmailCopySourceRef,
  parseGmailCopySourceRef,
} from "./source-ref";

const SENT_AT = "2026-09-06T16:00:00.000Z";
const HASH = "ab".repeat(32);

function realAttachmentId(length = 426): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let out = "ANGjdJ8_";
  while (out.length < length) {
    out += alphabet[out.length % alphabet.length];
  }
  return out.slice(0, length);
}

describe("Gmail copy-in source_ref bounds", () => {
  it("keeps non-Gmail at 240 and allows Gmail up to 2048", () => {
    assert.equal(PROJECT_ARTIFACT_SOURCE_REF_MAX, 240);
    assert.equal(PROJECT_ARTIFACT_GMAIL_SOURCE_REF_MAX, 2048);
    assert.equal(projectArtifactSourceRefMax("continuum"), 240);
    assert.equal(projectArtifactSourceRefMax("concierge-manual"), 240);
    assert.equal(projectArtifactSourceRefMax("gmail"), 2048);
    assert.equal(parseArtifactSourceRef("n".repeat(240)).ok, true);
    assert.equal(parseArtifactSourceRef("n".repeat(241)).ok, false);
    assert.equal(parseArtifactSourceRef("n".repeat(241), "continuum").ok, false);
    assert.equal(parseArtifactSourceRef("n".repeat(241), "gmail").ok, true);
    assert.equal(parseArtifactSourceRef("n".repeat(2048), "gmail").ok, true);
    assert.equal(parseArtifactSourceRef("n".repeat(2049), "gmail").ok, false);
    assert.equal(parseArtifactSourceRef("line\nbreak", "gmail").ok, false);
    assert.equal(parseArtifactSourceRef("line\rbreak").ok, false);
  });

  it("packs complete gm1 provenance for a real-length Gmail attachment id", () => {
    const attachmentId = realAttachmentId(426);
    assert.ok(attachmentId.length >= 426);
    assert.match(attachmentId, /_/);
    const packed = packGmailCopySourceRef({
      messageId: "19c4f8a2b1e90d3f",
      attachmentId,
      threadId: "19c4f8a2b1e90d40",
      sentAt: SENT_AT,
      fromEmailHash: HASH,
    });
    assert.equal(packed.ok, true);
    if (!packed.ok) return;
    assert.ok(packed.sourceRef.length > PROJECT_ARTIFACT_SOURCE_REF_MAX);
    assert.ok(packed.sourceRef.length <= PROJECT_ARTIFACT_GMAIL_SOURCE_REF_MAX);
    const parsed = parseGmailCopySourceRef(packed.sourceRef);
    assert.ok(parsed);
    assert.equal(parsed?.messageId, "19c4f8a2b1e90d3f");
    assert.equal(parsed?.attachmentId, attachmentId);
    assert.equal(parsed?.threadId, "19c4f8a2b1e90d40");
    assert.equal(parsed?.sentAt, SENT_AT);
    assert.equal(parsed?.fromEmailHash, HASH);
    assert.equal(packed.sourceRef.startsWith("gm1|"), true);
    assert.equal(packed.sourceRef.includes(attachmentId), true);
  });

  it("rejects a complete Gmail identity over 2048 without truncating", () => {
    const attachmentId = realAttachmentId(2000);
    const packed = packGmailCopySourceRef({
      messageId: "19c4f8a2b1e90d3f",
      attachmentId,
      threadId: "19c4f8a2b1e90d40",
      sentAt: SENT_AT,
      fromEmailHash: HASH,
    });
    assert.equal(packed.ok, false);
    if (packed.ok) return;
    assert.equal(packed.reason, "identity-too-long");
  });

  it("uses Project + message id + attachment id as the SQL uniqueness tuple", () => {
    const attachmentId = realAttachmentId(426);
    const packed = packGmailCopySourceRef({
      messageId: "19c4f8a2b1e90d3f",
      attachmentId,
      threadId: "19c4f8a2b1e90d40",
      sentAt: SENT_AT,
      fromEmailHash: HASH,
    });
    assert.equal(packed.ok, true);
    if (!packed.ok) return;
    const parts = packed.sourceRef.split("|");
    assert.equal(parts[0], "gm1");
    const sqlIdentity = (projectId: string) =>
      `${projectId}|${parts[1]}|${parts[2]}`;
    const projectA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const projectB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    assert.equal(sqlIdentity(projectA), sqlIdentity(projectA));
    assert.notEqual(sqlIdentity(projectA), sqlIdentity(projectB));
    assert.equal(parts[1], "19c4f8a2b1e90d3f");
    assert.equal(parts[2], attachmentId);
    const otherAttachment = realAttachmentId(427);
    assert.notEqual(attachmentId, otherAttachment);
    assert.notEqual(
      `${projectA}|${parts[1]}|${attachmentId}`,
      `${projectA}|${parts[1]}|${otherAttachment}`,
    );
  });
});
