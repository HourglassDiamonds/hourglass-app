import JsonLd from "@/app/shared-components/JsonLd";
import { marketingPageBreadcrumb } from "@/lib/seo/schema/breadcrumbs";

export default function EngagementRingsJsonLd() {
  return (
    <JsonLd data={marketingPageBreadcrumb("Engagement Rings", "/engagement-rings")} />
  );
}
