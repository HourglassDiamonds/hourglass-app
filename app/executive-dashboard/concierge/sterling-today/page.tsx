import { ConciergeBackLink } from "../components/concierge-back-link";
import { ConciergeShell } from "../components/concierge-shell";
import { SterlingTodayShadowControl } from "../components/sterling-today-shadow-control";
import {
  isSterlingTodayDurableLeaseAvailable,
  isSterlingTodaySemanticFeatureEnabled,
} from "@/lib/continuum/today-sterling/server-config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const metadata = {
  title: "Sterling Today shadow",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function SterlingTodayShadowPage() {
  const semanticAvailable = isSterlingTodaySemanticFeatureEnabled() && isSterlingTodayDurableLeaseAvailable();
  return (
    <ConciergeShell>
      <ConciergeBackLink />
      <SterlingTodayShadowControl semanticAvailable={semanticAvailable} />
    </ConciergeShell>
  );
}
