import { getAuthenticatedClientMemoryReader } from "@/lib/continuum/client-memory/read/load";
import { isPersonIdParam } from "@/lib/continuum/client-memory/read/presentation";
import { CONTINUUM_SOURCE_SYSTEMS } from "@/lib/continuum/contracts/types";
import { ConciergeShell } from "../../../components/concierge-shell";
import { ConciergeBackLink, ConciergeUnavailable } from "../../../components/client-profile-view";
import { ClientHistoryView } from "../../../components/client-history-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "History / Sources",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

function parseSource(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return (CONTINUUM_SOURCE_SYSTEMS as readonly string[]).includes(trimmed)
    ? trimmed
    : null;
}

export default async function ConciergePersonHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams?: Promise<{ page?: string; source?: string }>;
}) {
  const { personId } = await params;
  const query = searchParams ? await searchParams : {};
  if (!isPersonIdParam(personId)) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Client record unavailable."
          body="This client could not be found."
        />
      </ConciergeShell>
    );
  }

  const auth = await getAuthenticatedClientMemoryReader();
  if (!auth.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Client record unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  const page = parsePage(query.page);
  const sourceSystem = parseSource(query.source);
  let result: Awaited<ReturnType<typeof auth.reader.listPersonSourceHistory>>;
  try {
    result = await auth.reader.listPersonSourceHistory(personId, {
      page,
      sourceSystem,
    });
  } catch {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Client record unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  if (!result.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Client record unavailable."
          body="This client could not be found."
        />
      </ConciergeShell>
    );
  }

  return (
    <ConciergeShell>
      <ConciergeBackLink />
      <div className="hg-concierge-fade mt-8">
        <ClientHistoryView history={result.history} />
      </div>
    </ConciergeShell>
  );
}
