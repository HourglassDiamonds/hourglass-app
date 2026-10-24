import { splitOwnAndQuotedText } from "./candidates/spec-provenance";
import { extractCurrentMessageOperationalFacts } from "@/lib/continuum/source-events/operational-facts";

export const LIVE_MESSAGE_EXTRACTION_OUTCOMES = [
  "operational_current_text",
  "non_operational_current_text",
  "empty_current_text",
  "quote_only_current_content",
  "signature_or_boilerplate_only",
  "attachment_only",
  "uncertain_or_failed_decoding",
  "unsupported_message_format",
  "ambiguous_quote_stripping",
  "empty_plaintext_with_provider_snippet",
] as const;

export type LiveMessageExtractionOutcome =
  (typeof LIVE_MESSAGE_EXTRACTION_OUTCOMES)[number];

export type GmailBodyExtractionStatus =
  | "decoded_plaintext"
  | "decoded_html"
  | "empty"
  | "unsupported"
  | "decode_failed";

/** Privacy-safe, ephemeral facts only. Never includes source text or identifiers. */
export type LiveMessageExtractionDiagnostic = {
  outcome: LiveMessageExtractionOutcome;
  decodingSucceeded: boolean;
  currentMessageTextFound: boolean;
  operationalTextRecognized: boolean;
  attachmentMetadataPresent: boolean;
  providerFallbackAffectedExtraction: boolean;
  extractionUncertain: boolean;
};

const EXPLICIT_SIGNATURE_ONLY =
  /^(?:--\s*(?:\r?\n|$)[\s\S]*|sent from my (?:iphone|ipad|mobile device)[.!]?)$/i;
const POSSIBLE_UNPARSED_QUOTE =
  /(?:^|\n)\s*(?:>+\s*|on\s.{1,400}(?:wrote:)?\s*$|from:\s.+$|sent:\s.+$|[-_]{2,}\s*(?:original|forwarded) message)/im;

function isExplicitSignatureOnly(value: string): boolean {
  return EXPLICIT_SIGNATURE_ONLY.test(value.trim());
}

function hasAmbiguousQuoteBoundary(value: string, quoted: string): boolean {
  return !quoted && POSSIBLE_UNPARSED_QUOTE.test(value);
}

export function classifyLiveMessageExtraction(input: {
  plainText: string | null | undefined;
  providerSnippet: string | null | undefined;
  attachmentMetadataPresent: boolean;
  bodyExtractionStatus?: GmailBodyExtractionStatus | null;
}): LiveMessageExtractionDiagnostic {
  const status = input.bodyExtractionStatus;
  const plainText = input.plainText ?? "";
  const snippet = input.providerSnippet ?? "";
  const providerFallbackAffectedExtraction = !plainText.trim() && Boolean(snippet.trim());
  const effectiveText = plainText || snippet;
  const operationalTextRecognized = Boolean(
    extractCurrentMessageOperationalFacts(effectiveText),
  );

  const base = {
    attachmentMetadataPresent: input.attachmentMetadataPresent,
    providerFallbackAffectedExtraction,
    operationalTextRecognized,
  };
  if (!status) {
    return {
      ...base,
      outcome: "uncertain_or_failed_decoding",
      decodingSucceeded: false,
      currentMessageTextFound: false,
      extractionUncertain: true,
    };
  }
  if (status === "decode_failed") {
    return {
      ...base,
      outcome: "uncertain_or_failed_decoding",
      decodingSucceeded: false,
      currentMessageTextFound: false,
      extractionUncertain: true,
    };
  }
  if (status === "unsupported") {
    return {
      ...base,
      outcome: "unsupported_message_format",
      decodingSucceeded: false,
      currentMessageTextFound: false,
      extractionUncertain: true,
    };
  }
  if (providerFallbackAffectedExtraction) {
    return {
      ...base,
      outcome: "empty_plaintext_with_provider_snippet",
      decodingSucceeded: false,
      currentMessageTextFound: false,
      extractionUncertain: true,
    };
  }

  const split = splitOwnAndQuotedText(effectiveText);
  if (hasAmbiguousQuoteBoundary(effectiveText, split.quoted)) {
    return {
      ...base,
      outcome: "ambiguous_quote_stripping",
      decodingSucceeded: true,
      currentMessageTextFound: Boolean(split.own.trim()),
      extractionUncertain: true,
    };
  }
  if (!split.own.trim() && split.quoted.trim()) {
    return {
      ...base,
      outcome: "quote_only_current_content",
      decodingSucceeded: true,
      currentMessageTextFound: false,
      extractionUncertain: false,
    };
  }
  if (!split.own.trim()) {
    return {
      ...base,
      outcome: input.attachmentMetadataPresent ? "attachment_only" : "empty_current_text",
      decodingSucceeded: true,
      currentMessageTextFound: false,
      extractionUncertain: false,
    };
  }
  if (isExplicitSignatureOnly(split.own)) {
    return {
      ...base,
      outcome: "signature_or_boilerplate_only",
      decodingSucceeded: true,
      currentMessageTextFound: true,
      extractionUncertain: false,
    };
  }
  return {
    ...base,
    outcome: operationalTextRecognized
      ? "operational_current_text"
      : "non_operational_current_text",
    decodingSucceeded: true,
    currentMessageTextFound: true,
    extractionUncertain: false,
  };
}
