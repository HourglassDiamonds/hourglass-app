/**
 * Google OAuth production-readiness for gmail.readonly (RESTRICTED).
 * Does not print founder email or secrets.
 */

import {
  getGmailCloudProjectOrgAligned,
  getGmailMailboxHosting,
  getGmailOAuthPublishingStatus,
  getGmailOAuthUserType,
} from "./env";

export const GMAIL_OAUTH_CONFIGURATION_REQUIRED =
  "FOUNDER / GOOGLE CLOUD CONFIGURATION REQUIRED BEFORE ACTIVATION";

export type GmailOAuthProductionReadiness = {
  mailboxHosting: "workspace" | "consumer" | "unknown";
  cloudProjectOrgAligned: "yes" | "no" | "unknown";
  oauthUserType: "internal" | "external" | "unknown";
  publishingStatus: "testing" | "in-production" | "unknown";
  internalOauthAvailable: "yes" | "no" | "unknown";
  productionVerificationRequired: "yes" | "no" | "unknown";
  sevenDayAuthorizationExpiration: "yes" | "no" | "unknown";
  configurationGate: typeof GMAIL_OAUTH_CONFIGURATION_REQUIRED | null;
  notes: readonly string[];
};

export function assessGmailOAuthProductionReadiness(): GmailOAuthProductionReadiness {
  const mailboxHosting = getGmailMailboxHosting();
  const cloudProjectOrgAligned = getGmailCloudProjectOrgAligned();
  const oauthUserType = getGmailOAuthUserType();
  const publishingStatus = getGmailOAuthPublishingStatus();

  let internalOauthAvailable: "yes" | "no" | "unknown" = "unknown";
  if (mailboxHosting === "workspace" && cloudProjectOrgAligned === "yes") {
    internalOauthAvailable = oauthUserType === "external" ? "no" : "yes";
  } else if (mailboxHosting === "consumer" || cloudProjectOrgAligned === "no") {
    internalOauthAvailable = "no";
  } else if (oauthUserType === "internal") {
    internalOauthAvailable = "yes";
  } else if (oauthUserType === "external") {
    internalOauthAvailable = "no";
  }

  let productionVerificationRequired: "yes" | "no" | "unknown" = "unknown";
  if (oauthUserType === "internal") {
    productionVerificationRequired = "no";
  } else if (oauthUserType === "external") {
    productionVerificationRequired = "yes";
  }

  let sevenDayAuthorizationExpiration: "yes" | "no" | "unknown" = "unknown";
  if (oauthUserType === "internal") {
    sevenDayAuthorizationExpiration = "no";
  } else if (oauthUserType === "external" && publishingStatus === "testing") {
    sevenDayAuthorizationExpiration = "yes";
  } else if (oauthUserType === "external" && publishingStatus === "in-production") {
    sevenDayAuthorizationExpiration = "no";
  }

  const unknown =
    mailboxHosting === "unknown" ||
    cloudProjectOrgAligned === "unknown" ||
    oauthUserType === "unknown" ||
    publishingStatus === "unknown";

  const notes = [
    "gmail.readonly is a Google Restricted scope. Do not weaken the scope.",
    "Prefer Internal OAuth when the founder mailbox is Google Workspace and the Cloud project is owned by the same organization.",
    "Do not rely on External + Testing: refresh tokens may expire after 7 days.",
    "If Internal is unavailable, production must complete Google verification / In Production before durable mailbox activation.",
  ];

  return {
    mailboxHosting,
    cloudProjectOrgAligned,
    oauthUserType,
    publishingStatus,
    internalOauthAvailable,
    productionVerificationRequired,
    sevenDayAuthorizationExpiration,
    configurationGate: unknown ? GMAIL_OAUTH_CONFIGURATION_REQUIRED : null,
    notes,
  };
}
