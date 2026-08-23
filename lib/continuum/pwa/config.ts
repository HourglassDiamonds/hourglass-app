/**
 * Continuum private PWA identity.
 * Icons under /continuum/ are replaceable artwork — swap files, keep names.
 */

export const CONTINUUM_APP_NAME = "Continuum";
export const CONTINUUM_APP_SHORT_NAME = "Continuum";
export const CONTINUUM_DESCRIPTION = "Private relationship memory";
export const CONTINUUM_START_URL = "/executive-dashboard/concierge";
export const CONTINUUM_SCOPE = "/executive-dashboard/";
export const CONTINUUM_DISPLAY = "standalone" as const;
export const CONTINUUM_THEME_COLOR = "#14110f";
export const CONTINUUM_BACKGROUND_COLOR = "#14110f";
export const CONTINUUM_MANIFEST_PATH = "/continuum/manifest.webmanifest";
export const CONTINUUM_ICON_192 = "/continuum/icon-192.png";
export const CONTINUUM_ICON_512 = "/continuum/icon-512.png";
export const CONTINUUM_ICON_MASKABLE_512 = "/continuum/icon-maskable-512.png";
export const CONTINUUM_APPLE_TOUCH_ICON = "/continuum/apple-touch-icon.png";

export function continuumManifest() {
  return {
    name: CONTINUUM_APP_NAME,
    short_name: CONTINUUM_APP_SHORT_NAME,
    description: CONTINUUM_DESCRIPTION,
    start_url: CONTINUUM_START_URL,
    scope: CONTINUUM_SCOPE,
    display: CONTINUUM_DISPLAY,
    background_color: CONTINUUM_BACKGROUND_COLOR,
    theme_color: CONTINUUM_THEME_COLOR,
    lang: "en",
    icons: [
      {
        src: CONTINUUM_ICON_192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: CONTINUUM_ICON_512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: CONTINUUM_ICON_MASKABLE_512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
