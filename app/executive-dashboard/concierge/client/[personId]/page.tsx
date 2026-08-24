import { getAuthenticatedClientMemoryReader } from "@/lib/continuum/client-memory/read/load";
import { isPersonIdParam } from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../../components/concierge-shell";
import {
  ClientProfileView,
  ConciergeBackLink,
  ConciergeUnavailable,
} from "../../components/client-profile-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Client",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams?: Promise<{ saved?: string }>;
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

  let result: Awaited<ReturnType<typeof auth.reader.getPersonProfile>>;
  try {
    result = await auth.reader.getPersonProfile(personId);
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
        <ClientProfileView
          profile={result.profile}
          justSaved={query.saved === "1"}
          justSavedBirthday={query.saved === "birthday"}
        />
      </div>
    </ConciergeShell>
  );
}
