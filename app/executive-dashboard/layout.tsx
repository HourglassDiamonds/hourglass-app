import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import {
  CONTINUUM_APPLE_TOUCH_ICON,
  CONTINUUM_APP_NAME,
  CONTINUUM_BACKGROUND_COLOR,
  CONTINUUM_DESCRIPTION,
  CONTINUUM_MANIFEST_PATH,
  CONTINUUM_THEME_COLOR,
} from "@/lib/continuum/pwa/config";
import "./continuum-app.css";

export const metadata: Metadata = {
  title: {
    default: CONTINUUM_APP_NAME,
    template: `%s · ${CONTINUUM_APP_NAME}`,
  },
  description: CONTINUUM_DESCRIPTION,
  applicationName: CONTINUUM_APP_NAME,
  manifest: CONTINUUM_MANIFEST_PATH,
  robots: { index: false, follow: false, nocache: true, noarchive: true },
  icons: {
    apple: [
      {
        url: CONTINUUM_APPLE_TOUCH_ICON,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: CONTINUUM_APP_NAME,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: CONTINUUM_THEME_COLOR,
  colorScheme: "dark",
};

export const dynamic = "force-dynamic";

/**
 * Shared private headers for founder surfaces.
 * Metrics dashboard production hide lives in `(protected)/layout`.
 * Concierge is session-gated separately so it can run on a phone.
 * Continuum PWA metadata lives here so public marketing pages stay unchanged.
 */
export default function ExecutiveDashboardRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      data-continuum-app
      style={{ backgroundColor: CONTINUUM_BACKGROUND_COLOR, minHeight: "100%" }}
    >
      {children}
    </div>
  );
}
