import { ConciergeBackLink } from "../../components/concierge-back-link";
import { ConciergeShell } from "../../components/concierge-shell";
import { OperationalShadowControl } from "./operational-shadow-control";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata = { title: "Sterling operational shadow", robots: { index: false, follow: false, nocache: true, noarchive: true } };

export default function OperationalShadowPage() {
  return <ConciergeShell><ConciergeBackLink /><OperationalShadowControl /></ConciergeShell>;
}
