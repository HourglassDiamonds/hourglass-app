import { CONCIERGE_HUB_PATH } from "@/lib/continuum/operating-shell/destinations";
import { dateKeyInTimeZone } from "@/lib/continuum/personal-performance/program";
import { ConciergeBackLink } from "../components/concierge-back-link";
import { ConciergeShell } from "../components/concierge-shell";
import { PersonalPerformance } from "./personal-performance";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Personal Performance",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function ConciergePersonalPage() {
  const todayKey = dateKeyInTimeZone(new Date());
  return (
    <ConciergeShell variant="book">
      <ConciergeBackLink href={CONCIERGE_HUB_PATH} label="Home" />
      <PersonalPerformance todayKey={todayKey} />
    </ConciergeShell>
  );
}
