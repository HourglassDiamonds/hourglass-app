import type { Metadata } from "next";

import { LEDGER_HUB_DESCRIPTION } from "./ledger-seo";

export const metadata: Metadata = {
  title: {
    template: "%s | Ledger | Hourglass Diamonds",
    default: "Ledger: Systems Monitoring | Hourglass Diamonds",
  },
  description: LEDGER_HUB_DESCRIPTION,
  openGraph: {
    title: "Ledger: Systems Monitoring | Hourglass Diamonds",
    description: LEDGER_HUB_DESCRIPTION,
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
