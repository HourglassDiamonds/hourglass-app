import type { ReactNode } from "react";
import { CONCIERGE_HUB_PATH } from "@/lib/continuum/operating-shell/destinations";
import { ConciergeBackLink } from "../components/concierge-back-link";
import { ConciergeShell } from "../components/concierge-shell";

export default function PersonalLayout({ children }: { children: ReactNode }) {
  return <ConciergeShell variant="book"><ConciergeBackLink href={CONCIERGE_HUB_PATH} label="Home" />{children}</ConciergeShell>;
}
