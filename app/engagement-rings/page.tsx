import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/site-metadata";
import EngagementRingsJsonLd from "./components/EngagementRingsJsonLd";
import EngagementRingsPageClient from "./engagement-rings-page-client";

export const metadata: Metadata = pageMetadata({
  title: "Custom Engagement Rings",
  description:
    "Private, Graduate Gemologist-led engagement ring design for Charlotte, Waxhaw, and nationwide clients. Custom sourcing, intentional design, and unhurried decisions.",
  path: "/engagement-rings",
});

export default function EngagementRingsPage() {
  return (
    <>
      <EngagementRingsJsonLd />
      <EngagementRingsPageClient />
    </>
  );
}
