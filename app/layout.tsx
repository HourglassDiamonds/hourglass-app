import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  DEFAULT_OPEN_GRAPH,
  DEFAULT_SITE_DESCRIPTION,
  SITE_URL,
} from "@/lib/seo/site-metadata";
import "./globals.css";
import Footer from "./shared-components/Footer";
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
      <body className="min-h-full bg-[#f7f3ee] text-[#1f1d1a]">
        <GlobalJsonLd />
        <GoogleAnalytics />
        <div className="flex min-h-screen flex-col">
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}