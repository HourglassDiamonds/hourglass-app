import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getAuthenticatedClientMemoryReader } from "@/lib/continuum/client-memory/read/load";
import {
  conciergeClientPath,
  currentBirthdayFact,
  isPersonIdParam,
} from "@/lib/continuum/client-memory/read/presentation";
import { parseBirthdayValue } from "@/lib/continuum/client-memory/facts/date";
import { ConciergeShell } from "../../../components/concierge-shell";
import { ConciergeUnavailable } from "../../../components/client-profile-view";
import { AddBirthdayForm } from "../../../components/add-birthday-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Birthday",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeBirthdayPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
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

  const profile = result.profile;
  const existing = currentBirthdayFact(profile.facts.current);
  const parsed = existing ? parseBirthdayValue(existing.value) : null;
  const value = parsed?.ok ? parsed.value : null;

  return (
    <ConciergeShell>
      <Link
        href={conciergeClientPath(personId)}
        aria-label={`Back to ${profile.person.displayName}`}
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← {profile.person.displayName}
      </Link>
      <div className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          {value ? "Edit birthday" : "Add birthday"}
        </h1>
        <div className="mt-8">
          <AddBirthdayForm
            personId={personId}
            personName={profile.person.displayName}
            submissionId={randomUUID()}
            replacing={value != null}
            initialMonth={value?.month ?? null}
            initialDay={value?.day ?? null}
            initialYear={value?.year ?? null}
          />
        </div>
      </div>
    </ConciergeShell>
  );
}
