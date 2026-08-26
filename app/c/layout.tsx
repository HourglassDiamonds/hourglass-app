import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { CONTINUUM_BACKGROUND_COLOR, CONTINUUM_THEME_COLOR } from "@/lib/continuum/pwa/config";
import "./card.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: CONTINUUM_THEME_COLOR,
  colorScheme: "dark",
};

export default function PublicCardLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-continuum-card
      style={{ backgroundColor: CONTINUUM_BACKGROUND_COLOR, minHeight: "100%" }}
    >
      {children}
    </div>
  );
}
