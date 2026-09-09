import { ConciergeShell } from "../components/concierge-shell";
import { ConciergeAskHome } from "../components/concierge-ask-home";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Concierge",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function ConciergeAskPage() {
  return (
    <ConciergeShell variant="home">
      <ConciergeAskHome />
    </ConciergeShell>
  );
}
