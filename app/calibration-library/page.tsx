import type { Metadata } from "next";
import { notFound } from "next/navigation";
import IngestClient from "./ingest-client";

export const metadata: Metadata = {
  title: "Calibration Library",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function CalibrationLibraryPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <IngestClient />;
}
