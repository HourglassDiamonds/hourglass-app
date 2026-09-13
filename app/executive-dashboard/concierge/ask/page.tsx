import type { ConciergeAskMode } from "@/lib/continuum/client-memory/read/presentation";
import { CONCIERGE_ASK_MODES } from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../components/concierge-shell";
import { ConciergeAskHome } from "../components/concierge-ask-home";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Concierge",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

function parseAskMode(value: string | undefined): ConciergeAskMode {
  if (value && (CONCIERGE_ASK_MODES as readonly string[]).includes(value)) {
    return value as ConciergeAskMode;
  }
  return "conversation";
}

export default async function ConciergeAskPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string; q?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  return (
    <ConciergeShell variant="home">
      <ConciergeAskHome
        mode={parseAskMode(query.mode)}
        initialQuery={typeof query.q === "string" ? query.q : ""}
      />
    </ConciergeShell>
  );
}
