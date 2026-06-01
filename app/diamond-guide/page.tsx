import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/site-metadata";
import DiamondGuidePageClient from "./diamond-guide-page-client";

export const metadata: Metadata = pageMetadata({
  title: "Diamond Guide",
  description:
    "Clear, practical diamond education—size, shape, cut, light, color, clarity, certification, and buying strategy—in one calm reference.",
  path: "/diamond-guide",
});

export default function DiamondGuidePage() {
  return <DiamondGuidePageClient />;
}
