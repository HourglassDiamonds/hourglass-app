import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Light Performance Calibration Library",
  description: "Internal report ingestion for calibration workbook.",
  robots: { index: false, follow: false },
};

export default function CalibrationLibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
