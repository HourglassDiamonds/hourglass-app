import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/site-metadata";
import HomePageClient from "./home-page-client";

export const metadata: Metadata = pageMetadata({
  title: "Custom Engagement Rings & Fine Jewelry",
  description:
    "Private gemologist-led guidance for custom engagement rings and fine jewelry—thoughtful sourcing, calm process, nationwide.",
  path: "/",
});

export default function HomePage() {
  return <HomePageClient />;
}
