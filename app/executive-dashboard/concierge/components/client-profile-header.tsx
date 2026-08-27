import {
  formatLocation,
  mailtoHref,
  telHref,
} from "@/lib/continuum/client-memory/read/presentation";
import type { PersonCockpitPerson } from "@/lib/continuum/client-memory/read/types";
import { ReviewIndicator } from "./review-indicator";

export function ClientProfileHeader({
  person,
  openCount,
}: {
  person: PersonCockpitPerson;
  openCount: number;
}) {
  const location = formatLocation(person);
  const mail = mailtoHref(person.email);
  const tel = telHref(person.phone);

  return (
    <header>
      <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de] md:text-[2.55rem]">
        {person.displayName}
      </h1>

      <div className="mt-6 space-y-3 text-[15px] leading-relaxed">
        {person.email ? (
          mail ? (
            <a
              href={mail}
              className="block min-h-11 break-words text-[#efe8de] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ad9164]"
            >
              {person.email}
            </a>
          ) : (
            <p className="break-words text-[#efe8de]">{person.email}</p>
          )
        ) : null}
        {person.phone ? (
          tel ? (
            <a
              href={tel}
              className="block min-h-11 text-[#efe8de] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ad9164]"
            >
              {person.phone}
            </a>
          ) : (
            <p className="text-[#efe8de]">{person.phone}</p>
          )
        ) : null}
        {location ? (
          <p className="text-[#cbbfb2]">{location}</p>
        ) : null}
      </div>

      <div className="mt-5">
        <ReviewIndicator openCount={openCount} />
      </div>
    </header>
  );
}