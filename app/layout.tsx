import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "./shared-components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hourglass Diamonds",
  description:
    "A more thoughtful way to design engagement rings and fine jewelry. Private guidance, refined sourcing, and a calm, personal process.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#f7f3ee] text-[#1f1d1a]">
        <div className="flex min-h-screen flex-col">
          
          {/* Page Content */}
          <main className="flex-1">
            {children}
          </main>

          {/* Global Footer */}
          <Footer />

        </div>
      </body>
    </html>
  );
}