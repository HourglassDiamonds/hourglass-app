import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/site-metadata";
import AccessibilityStatement from "./accessibility-statement";

export const metadata: Metadata = pageMetadata({
  title: "Accessibility",
  description:
    "Hourglass Diamonds' accessibility commitment, ongoing improvement work, and how to report a barrier.",
  path: "/accessibility",
});

export default function AccessibilityPage() {
  return <AccessibilityStatement />;
}
