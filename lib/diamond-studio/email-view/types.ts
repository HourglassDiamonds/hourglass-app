/**
 * Email This View — identified Studio activity, not a sales inquiry.
 *
 * Sending a configuration is not marketing consent and does not create
 * a Concierge / HubSpot deal. Future matching is exact normalized email
 * against a later Concierge identity — never probabilistic.
 */

import type { AttributionSnapshot } from "@/lib/attribution";
import type { DiamondStudioConfiguration } from "@/lib/diamond-studio/configuration";

export const STUDIO_VIEW_EMAILED_EVENT = "studio_view_emailed" as const;

export const STUDIO_VIEW_EMAIL_SUBJECT = "Your Diamond Studio view";

export const STUDIO_VIEW_EMAIL_HEADING = "Your Diamond Studio view";

export const STUDIO_VIEW_EMAIL_SUPPORTING =
  "The configuration you were comparing, saved here for easy reference.";

export const STUDIO_VIEW_EMAIL_CTA =
  "View this configuration in Diamond Studio →";

export const STUDIO_VIEW_EMAIL_CALIBRATION_NOTE =
  "Diamond sizing shown at calibrated scale based on the selected configuration.";

export const STUDIO_VIEW_EMAIL_BRAND = "Hourglass Diamonds";

export const STUDIO_VIEW_EMAIL_MAX_BODY_BYTES = 8_192;

export const STUDIO_VIEW_EMAIL_MAX_FIRST_NAME = 40;

export type StudioViewEmailedStatus = "sent";

export type StudioViewEmailedRecord = {
  event: typeof STUDIO_VIEW_EMAILED_EVENT;
  id: string;
  timestamp: string;
  recipientEmail: string;
  emailNormalized: string;
  emailHash: string;
  firstName?: string;
  configuration: DiamondStudioConfiguration;
  studioSharePath: string;
  attribution?: AttributionSnapshot;
  status: StudioViewEmailedStatus;
  /** Always false for this action. Marketing is a separate consent. */
  marketingConsent: false;
  /** Always false for this action. Concierge is a separate inquiry. */
  inquiryCreated: false;
};

export type StudioViewEmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: "image/jpeg";
  contentId: string;
};

export type StudioViewEmailSender = (input: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments: StudioViewEmailAttachment[];
}) => Promise<
  | { ok: true; providerMessageId: string | null }
  | { ok: false; error: string }
>;

export type HandleEmailStudioViewResult =
  | {
      ok: true;
      accepted: boolean;
      message: string;
      record?: StudioViewEmailedRecord;
      persistence?: {
        durable: boolean;
        status: "durable" | "memory" | "failed";
        adapter: "supabase" | "memory" | "none";
      };
    }
  | {
      ok: false;
      accepted: false;
      message: string;
      status: number;
      code:
        | "invalid_email"
        | "unsupported_configuration"
        | "payload_too_large"
        | "rate_limited"
        | "mail_failed"
        | "unconfigured"
        | "invalid_request";
      retryAfterSeconds?: number;
    };
