import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/site-metadata";
import EngagementRingsPageClient from "./engagement-rings-page-client";

export const metadata: Metadata = pageMetadata({
  title: "Custom Engagement Rings",
  description:
    "A private, guided path to an engagement ring designed around you—clear diamond guidance, intentional design, and unhurried decisions.",
  path: "/engagement-rings",
});

export default function EngagementRingsPage() {
  return <EngagementRingsPageClient />;
}
