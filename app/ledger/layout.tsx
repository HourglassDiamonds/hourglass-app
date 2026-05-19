import type { Metadata } from "next";

const LEDGER_DESCRIPTION =
  "Weekly intelligence on markets, infrastructure, AI, energy, and global systems — from Hourglass Diamonds.";

export const metadata: Metadata = {
  title: {
    template: "%s | Hourglass Ledger",
    default: "Hourglass Ledger",
  },
  description: LEDGER_DESCRIPTION,
  openGraph: {
    title: "Hourglass Ledger",
    description: LEDGER_DESCRIPTION,
    type: "website",
  },
};

export default function LedgerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
