import Link from "next/link";
import {
  conciergeAddClientPath,
  conciergeClientPath,
} from "@/lib/continuum/client-memory/read/presentation";
import type { ClientWebsiteIntake } from "@/lib/continuum/client-memory/read/website-intake";
import { ConciergeSearch } from "./concierge-search";
import { ConciergeIntakeDetail } from "./concierge-intake-detail";

export type ClientsHomePerson = {
  personId: string;
  displayName: string;
  projectTitle: string | null;
  kind: "client" | "prospect" | "vendor";
};

function PersonList({
  people,
  empty,
}: {
  people: ClientsHomePerson[];
  empty: string;
}) {
  if (people.length === 0) {
    return (
      <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed text-[#c4b7aa]">
        {empty}
      </p>
    );
  }
  return (
    <ul className="mt-3 divide-y divide-white/[0.06]">
      {people.map((person) => (
        <li key={person.personId}>
          <Link
            href={conciergeClientPath(person.personId)}
            className="block min-h-14 py-4 outline-none transition-colors hover:text-[#ad9164]"
          >
            <span className="block font-serif text-[1.28rem] leading-[1.15] tracking-[-0.03em] text-[#efe8de]">
              {person.displayName}
            </span>
            {person.projectTitle ? (
              <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] text-[#8d8073]">
                {person.projectTitle}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ClientsHome({
  people,
  intakes = [],
}: {
  people: ClientsHomePerson[];
  intakes?: ClientWebsiteIntake[];
}) {
  const clients = people.filter((person) => person.kind === "client");
  const prospects = people.filter((person) => person.kind === "prospect");
  const vendors = people.filter((person) => person.kind === "vendor");
  return (
    <div data-clients-home className="hg-concierge-fade">
      <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de]">
        Clients
      </h1>
      <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-[#c4b7aa]">
        A private book of people Continuum already knows. Vendors stay vendors.
      </p>
      <div className="mt-8">
        <ConciergeSearch autoFocus />
      </div>
      {intakes.length > 0 ? (
        <section className="mt-10" data-clients-book="intakes">
          <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            New intakes
          </h2>
          <ul className="mt-3 divide-y divide-white/[0.06]">
            {intakes.map((intake, index) => (
              <li key={intake.intakeId} className="min-w-0 py-5">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-5 gap-y-2">
                  <div className="min-w-0">
                    {intake.personId ? (
                      <Link
                        href={conciergeClientPath(intake.personId)}
                        className="font-serif text-[1.28rem] leading-[1.15] tracking-[-0.03em] text-[#efe8de] outline-none hover:text-[#ad9164]"
                      >
                        {intake.fullName}
                      </Link>
                    ) : (
                      <p className="font-serif text-[1.28rem] leading-[1.15] tracking-[-0.03em] text-[#efe8de]">
                        {intake.fullName}
                      </p>
                    )}
                    <p className="mt-1 break-words text-[13px] leading-relaxed text-[#c4b7aa]">
                      {intake.email}
                      {intake.phone ? ` · ${intake.phone}` : ""}
                    </p>
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#ad9164]">
                    {intake.identityStatus === "needs_review"
                      ? "Identity needs review"
                      : intake.identityStatus === "matched"
                        ? "Known person"
                        : "Prospect"}
                  </p>
                </div>
                <ConciergeIntakeDetail
                  intake={intake}
                  defaultOpen={index === 0 && intake.identityStatus === "new"}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="mt-10" data-clients-book="prospects">
        <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
          Prospects
        </h2>
        <PersonList
          people={prospects}
          empty="Website prospects appear here after a canonical intake is linked."
        />
      </section>
      <section className="mt-10" data-clients-book="clients">
        <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
          Clients
        </h2>
        <PersonList
          people={clients}
          empty="Search by name, email, or phone to open a person."
        />
      </section>
      <section className="mt-10" data-clients-book="vendors">
        <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
          Vendors
        </h2>
        <PersonList
          people={vendors}
          empty="Vendor organizations and shop contacts appear here."
        />
      </section>
      <p className="mt-10">
        <Link
          href={conciergeAddClientPath()}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
        >
          Add client
        </Link>
      </p>
    </div>
  );
}
