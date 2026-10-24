import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GmailApiMessage } from "./types";
import { protectExactThreadMessage } from "./exact-thread-payload";

function message(mimeType: string, data: string): GmailApiMessage {
  return {
    id: "message",
    threadId: "thread",
    internalDate: "1792800000000",
    payload: {
      mimeType,
      headers: [],
      body: { data, size: data.length },
    },
  };
}

describe("exact-thread body extraction diagnostics", () => {
  it("reports decoded plaintext and HTML without changing protected text", () => {
    const plain = protectExactThreadMessage(message("text/plain",
      Buffer.from("CAD attached.").toString("base64url")));
    assert.equal(plain.bodyExtractionStatus, "decoded_plaintext");
    assert.equal(plain.plainText, "CAD attached.");

    const html = protectExactThreadMessage(message("text/html",
      Buffer.from("<p>CAD attached.</p>").toString("base64url")));
    assert.equal(html.bodyExtractionStatus, "decoded_html");
    assert.equal(html.plainText, "CAD attached.");
  });

  it("distinguishes unsupported bodies and malformed UTF-8", () => {
    const unsupported = protectExactThreadMessage(message("application/octet-stream",
      Buffer.from("opaque").toString("base64url")));
    assert.equal(unsupported.bodyExtractionStatus, "unsupported");
    assert.equal(unsupported.plainText, null);

    const malformed = protectExactThreadMessage(message("text/plain",
      Buffer.from([0xc3, 0x28]).toString("base64url")));
    assert.equal(malformed.bodyExtractionStatus, "decode_failed");
  });
});
