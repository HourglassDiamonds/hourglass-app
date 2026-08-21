import { CARD_COLORS } from "@/lib/diamond-studio/snapshot/card";
import {
  formatStudioCardCopy,
  type DiamondStudioConfiguration,
} from "@/lib/diamond-studio/configuration";
import {
  STUDIO_VIEW_EMAIL_BRAND,
  STUDIO_VIEW_EMAIL_CALIBRATION_NOTE,
  STUDIO_VIEW_EMAIL_CTA,
  STUDIO_VIEW_EMAIL_HEADING,
  STUDIO_VIEW_EMAIL_SUBJECT,
  STUDIO_VIEW_EMAIL_SUPPORTING,
} from "./types";
import { studioAbsoluteShareUrl } from "./origin";

export const STUDIO_CARD_CONTENT_ID = "studio-share-card";

const MARKETING_LANGUAGE = [
  "dream ring",
  "exclusive",
  "limited time",
  "act now",
  "newsletter",
  "unsubscribe",
  "book a consultation",
  "ready to buy",
];

export type RenderedStudioViewEmail = {
  subject: string;
  html: string;
  text: string;
  shareUrl: string;
  headline: string;
  detail: string;
};

export function renderStudioViewEmail(input: {
  configuration: DiamondStudioConfiguration;
  sharePath: string;
  firstName?: string;
  env?: NodeJS.ProcessEnv;
}): RenderedStudioViewEmail {
  const copy = formatStudioCardCopy(input.configuration);
  const shareUrl = studioAbsoluteShareUrl(input.sharePath, input.env);
  const orientation = copy.orientationLine
    ? `\n${copy.orientationLine}`
    : "";

  const text = [
    STUDIO_VIEW_EMAIL_BRAND,
    "",
    STUDIO_VIEW_EMAIL_HEADING,
    STUDIO_VIEW_EMAIL_SUPPORTING,
    "",
    copy.headline,
    `${copy.detail}${orientation}`,
    "",
    STUDIO_VIEW_EMAIL_CTA,
    shareUrl,
    "",
    STUDIO_VIEW_EMAIL_CALIBRATION_NOTE,
  ].join("\n");

  const orientationHtml = copy.orientationLine
    ? `<br /><span style="font-size:13px;line-height:1.4;color:${CARD_COLORS.muted};">${escapeHtml(copy.orientationLine)}</span>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(STUDIO_VIEW_EMAIL_SUBJECT)}</title>
</head>
<body style="margin:0;padding:0;background-color:${CARD_COLORS.ivory};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${CARD_COLORS.ivory};">
    <tr>
      <td align="center" style="padding:28px 16px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:640px;margin:0 auto;">
          <tr>
            <td style="padding:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.4;letter-spacing:0.22em;text-transform:uppercase;color:${CARD_COLORS.gold};">
              ${escapeHtml(STUDIO_VIEW_EMAIL_BRAND)}
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 6px;font-family:Georgia,'Times New Roman',Times,serif;font-size:28px;line-height:1.25;color:${CARD_COLORS.ink};">
              ${escapeHtml(STUDIO_VIEW_EMAIL_HEADING)}
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 14px;font-family:Georgia,'Times New Roman',Times,serif;font-size:15px;line-height:1.5;color:${CARD_COLORS.muted};word-break:normal;">
              ${escapeHtml(STUDIO_VIEW_EMAIL_SUPPORTING)}
            </td>
          </tr>
          <tr>
            <td style="padding:0;font-size:0;line-height:0;">
              <img src="cid:${STUDIO_CARD_CONTENT_ID}" alt="${escapeHtml(copy.headline)}" width="640" style="display:block;width:100%;max-width:640px;height:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0 0;font-family:Georgia,'Times New Roman',Times,serif;font-size:26px;line-height:1.2;color:${CARD_COLORS.ink};">
              ${escapeHtml(copy.headline)}
            </td>
          </tr>
          <tr>
            <td style="padding:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:${CARD_COLORS.muted};">
              ${escapeHtml(copy.detail)}${orientationHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:14px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="border-top:1px solid ${CARD_COLORS.line};font-size:0;line-height:0;height:1px;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0 0;font-family:Arial,Helvetica,sans-serif;">
              <a href="${escapeHtml(shareUrl)}" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;font-weight:600;letter-spacing:0.06em;color:${CARD_COLORS.ink};text-decoration:none;border-bottom:1px solid ${CARD_COLORS.gold};padding-bottom:2px;">
                ${escapeHtml(STUDIO_VIEW_EMAIL_CTA)}
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.45;color:${CARD_COLORS.muted};">
              ${escapeHtml(STUDIO_VIEW_EMAIL_CALIBRATION_NOTE)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: STUDIO_VIEW_EMAIL_SUBJECT,
    html,
    text,
    shareUrl,
    headline: copy.headline,
    detail: copy.detail,
  };
}

export function studioViewEmailContainsMarketingLanguage(
  rendered: RenderedStudioViewEmail,
): boolean {
  const blob = `${rendered.subject}\n${rendered.html}\n${rendered.text}`.toLowerCase();
  return MARKETING_LANGUAGE.some((phrase) => blob.includes(phrase));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
