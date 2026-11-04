import type { AcknowledgementCopy } from "./types";

/** Founder-approved service acknowledgment. Preparation does not imply send approval. */
export const APPROVED_CONCIERGE_ACKNOWLEDGEMENT_COPY: AcknowledgementCopy = {
  copyVersion: "quiet-luxury-v1",
  approvalStatus: "founder_approved",
  subject: "Your Hourglass Concierge inquiry",
  text: "Thank you for reaching out to Hourglass Diamonds. Justin will personally review your note and follow up thoughtfully. There is nothing more you need to do for now.",
};
