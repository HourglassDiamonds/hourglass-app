import JsonLd from "@/app/shared-components/JsonLd";
import { marketingPageBreadcrumb } from "@/lib/seo/schema/breadcrumbs";

type MarketingPageJsonLdProps = {
  name: string;
  path: string;
};

export default function MarketingPageJsonLd({
  name,
  path,
}: MarketingPageJsonLdProps) {
  return <JsonLd data={marketingPageBreadcrumb(name, path)} />;
}
