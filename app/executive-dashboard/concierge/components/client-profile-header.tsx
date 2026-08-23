import {
  formatLocation,
  mailtoHref,
  telHref,
} from "@/lib/continuum/client-memory/read/presentation";
import type { ConciergePersonProfile } from "@/lib/continuum/client-memory/read/types";
import { ReviewIndicator } from "./review-indicator";

export function ClientProfileHeader({
  profile,
}: {
  profile: ConciergePersonProfile;
}) {
  const { person } = profile;
  const location = formatLocation(person);
  const mail = mailtoHref(person.email);
  const tel = telHref(person.phone);
  const role =
    person.roles.includes("client") && person.roles.length === 1
      ? null
      : person.roles.filter((item) => item !== "client").join(" · ");

  return (
    <header>
      <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de] md:text-[2.55rem]">
        {person.displayName}
      </h1>
      {person.organizationName ? (
        <p className="mt-3 text-[15px] leading-relaxed text-[#cbbfb2]">
          {person.organizationName}
        </p>
      ) : null}
      {role ? (
        <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-[#8d8073]">
          {role}
        </p>
      ) : null}

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
        <ReviewIndicator openCount={profile.reviews.openCount} />
      </div>
    </header>
  );
}
