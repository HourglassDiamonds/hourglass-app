import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/site-metadata";
import CustomDesignPageClient from "./custom-design-page-client";

export const metadata: Metadata = pageMetadata({
  title: "Custom Jewelry Design",
  description:
    "Custom rings and fine jewelry through conversation, selective sourcing, and step-by-step refinement—personal from first sketch to finished piece.",
  path: "/custom-design",
});

export default function CustomDesignPage() {
  return <CustomDesignPageClient />;
}
