import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  DEFAULT_OPEN_GRAPH,
  DEFAULT_OG_IMAGE,
  DEFAULT_SITE_DESCRIPTION,
  SITE_URL,
} from "@/lib/seo/site-metadata";
import "./globals.css";
import Footer from "./shared-components/Footer";
import FacetScintillationRail from "./shared-components/motion/FacetScintillationRail";
import GlobalJsonLd from "./shared-components/GlobalJsonLd";
import GoogleAnalytics from "./shared-components/GoogleAnalytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Hourglass Diamonds",
    template: "%s | Hourglass Diamonds",
  },
  description: DEFAULT_SITE_DESCRIPTION,
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: "Hourglass Diamonds",
    description: DEFAULT_SITE_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Hourglass Diamonds",
    description: DEFAULT_SITE_DESCRIPTION,
    images: [`${SITE_URL}${DEFAULT_OG_IMAGE.url}`],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-hg-body text-hg-ink">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:border focus:border-hg-line focus:bg-hg-ivory focus:px-5 focus:py-3 focus:text-[12px] focus:tracking-[0.04em] focus:text-hg-ink focus:shadow-hg-lifted"
        >
          Skip to main content
        </a>
        <FacetScintillationRail />
        <GlobalJsonLd />
        <GoogleAnalytics />
        <div className="flex min-h-screen flex-col">
          <main id="main-content" tabIndex={-1} className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}