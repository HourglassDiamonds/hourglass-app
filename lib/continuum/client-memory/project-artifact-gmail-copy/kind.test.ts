import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PROJECT_ARTIFACT_KINDS } from "../project-artifacts/types";
import { mapGmailCopyArtifactKind } from "./kind";

describe("Gmail copy-in canonical kind mapping", () => {
  it("maps manifest labels onto live #14 kinds and never persists aliases", () => {
    assert.equal(mapGmailCopyArtifactKind("cad_render"), "cad");
    assert.equal(mapGmailCopyArtifactKind("CAD presentation"), "cad");
    assert.equal(mapGmailCopyArtifactKind("CAD finger render"), "cad");
    assert.equal(mapGmailCopyArtifactKind("vendor_paperwork"), "document");
    assert.equal(mapGmailCopyArtifactKind("vendor order confirmation"), "document");
    assert.equal(mapGmailCopyArtifactKind("quote"), "document");
    assert.equal(mapGmailCopyArtifactKind("invoice PDF"), "document");
    assert.equal(mapGmailCopyArtifactKind("client_image"), "inspiration");
    assert.equal(mapGmailCopyArtifactKind("client reference ring photo"), "inspiration");
    const forbidden = ["cad_render", "vendor_paperwork", "client_image"];
    for (const kind of PROJECT_ARTIFACT_KINDS) {
      assert.equal(mapGmailCopyArtifactKind(kind), kind);
    }
    assert.equal(forbidden.includes(String(mapGmailCopyArtifactKind("cad_render"))), false);
    assert.equal(forbidden.includes(String(mapGmailCopyArtifactKind("vendor_paperwork"))), false);
    assert.equal(forbidden.includes(String(mapGmailCopyArtifactKind("client_image"))), false);
    assert.equal(mapGmailCopyArtifactKind("not-a-kind"), null);
  });
});
