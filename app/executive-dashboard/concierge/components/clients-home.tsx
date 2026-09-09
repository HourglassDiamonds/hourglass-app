import Link from "next/link";
import {
  conciergeAddClientPath,
  conciergeClientPath,
} from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeSearch } from "./concierge-search";

export type ClientsHomePerson = {
  personId: string;
  displayName: string;
  projectTitle: string | null;
};

export function ClientsHome({ people }: { people: ClientsHomePerson[] }) {
  return (
    <div data-clients-home className="hg-concierge-fade">
      <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.045em] text-[#efe8de]">
        Clients
      </h1>
      <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-[#c4b7aa]">
        A private book of people Continuum already knows.
      </p>
      <div className="mt-8">
        <ConciergeSearch autoFocus />
      </div>
      {people.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            On current work
          </h2>
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
        </section>
      ) : (
        <p className="mt-10 max-w-[34ch] text-[15px] leading-relaxed text-[#c4b7aa]">
          Search by name, email, or phone to open a person.
        </p>
      )}
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
