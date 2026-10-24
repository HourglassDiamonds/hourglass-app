import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyLiveMessageExtraction } from "./live-extraction-diagnostics";

function classify(overrides: Partial<Parameters<typeof classifyLiveMessageExtraction>[0]> = {}) {
  return classifyLiveMessageExtraction({
    plainText: "Production has started.",
    providerSnippet: null,
    attachmentMetadataPresent: false,
    bodyExtractionStatus: "decoded_plaintext",
    ...overrides,
  });
}

describe("privacy-safe live-message extraction diagnostics", () => {
  it("separates operational and non-operational current text", () => {
    assert.equal(classify().outcome, "operational_current_text");
    const acknowledgment = classify({ plainText: "Sounds good, thank you." });
    assert.equal(acknowledgment.outcome, "non_operational_current_text");
    assert.equal(acknowledgment.currentMessageTextFound, true);
    assert.equal(acknowledgment.operationalTextRecognized, false);
    assert.equal(acknowledgment.extractionUncertain, false);
  });

  it("distinguishes empty, quote-only, signature-only, and attachment-only messages", () => {
    assert.equal(classify({ plainText: null, bodyExtractionStatus: "empty" }).outcome,
      "empty_current_text");
    assert.equal(classify({ plainText: "On Oct 1, Shop wrote:\nCAD attached." }).outcome,
      "quote_only_current_content");
    assert.equal(classify({ plainText: "--\nExample signature" }).outcome,
      "signature_or_boilerplate_only");
    const attachment = classify({ plainText: null, bodyExtractionStatus: "empty",
      attachmentMetadataPresent: true });
    assert.equal(attachment.outcome, "attachment_only");
    assert.equal(attachment.attachmentMetadataPresent, true);
  });

  it("keeps attachment presence independent from recognized text", () => {
    const mixed = classify({ attachmentMetadataPresent: true });
    assert.equal(mixed.outcome, "operational_current_text");
    assert.equal(mixed.attachmentMetadataPresent, true);
  });

  it("marks snippet fallback, unsupported format, decoding failure, and ambiguous quotes uncertain", () => {
    const snippet = classify({ plainText: "", providerSnippet: "CAD attached.",
      bodyExtractionStatus: "empty" });
    assert.equal(snippet.outcome, "empty_plaintext_with_provider_snippet");
    assert.equal(snippet.providerFallbackAffectedExtraction, true);
    assert.equal(snippet.extractionUncertain, true);

    assert.equal(classify({ plainText: null, bodyExtractionStatus: "unsupported" }).outcome,
      "unsupported_message_format");
    assert.equal(classify({ plainText: null, bodyExtractionStatus: "decode_failed" }).outcome,
      "uncertain_or_failed_decoding");
    assert.equal(classify({ plainText: "From: Someone\nCAD attached." }).outcome,
      "ambiguous_quote_stripping");
    const legacyWithoutStatus = classify({ bodyExtractionStatus: undefined });
    assert.equal(legacyWithoutStatus.outcome, "uncertain_or_failed_decoding");
    assert.equal(legacyWithoutStatus.extractionUncertain, true);
  });

  it("returns no source content or identifiers", () => {
    const diagnostic = classify({ plainText: "Private client wording and CAD attached." });
    const serialized = JSON.stringify(diagnostic);
    assert.doesNotMatch(serialized, /Private client wording|messageId|threadId|subject|filename/i);
  });
});
