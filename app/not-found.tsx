import SiteRecovery from "./shared-components/SiteRecovery";

export default function NotFound() {
  return (
    <SiteRecovery
      eyebrow="Page not found"
      title="This page isn’t here."
      body="The link may be mistyped, or the page has moved. Return home or reach Justin through Concierge."
    />
  );
}
