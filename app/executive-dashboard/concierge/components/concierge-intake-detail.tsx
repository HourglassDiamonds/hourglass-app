import {
  websiteIntakeFields,
  websiteIntakeSubmittedLabel,
  websiteIntakeWhatMatters,
} from "@/lib/continuum/client-memory/read/website-intake-presentation";
import type { ClientWebsiteIntake } from "@/lib/continuum/client-memory/read/website-intake";
import { WebsiteIntakeControls } from "./website-intake-controls";

function fieldValue(field: ReturnType<typeof websiteIntakeFields>[number]) {
  const className = `mt-1 min-w-0 break-words text-[15px] leading-relaxed text-[#efe8de]${
    field.kind === "notes" ? " whitespace-pre-wrap" : ""
  }`;
  if (field.kind === "email") {
    return (
      <a className={`${className} block underline-offset-4 hover:underline`} href={`mailto:${field.value}`}>
        {field.value}
      </a>
    );
  }
  if (field.kind === "phone") {
    return (
      <a className={`${className} block underline-offset-4 hover:underline`} href={`tel:${field.value}`}>
        {field.value}
      </a>
    );
  }
  return <p className={className}>{field.value}</p>;
}

export function ConciergeIntakeDetail({
  intake,
  defaultOpen = false,
}: {
  intake: ClientWebsiteIntake;
  defaultOpen?: boolean;
}) {
  const fields = websiteIntakeFields(intake);
  const whatMatters = websiteIntakeWhatMatters(intake);
  const submitted = websiteIntakeSubmittedLabel(intake.submittedAt);
  return (
    <details
      data-concierge-intake={intake.intakeId}
      open={defaultOpen}
      className="group mt-5 border-y border-white/[0.08]"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 outline-none marker:content-none focus-visible:text-[#efe8de] [&::-webkit-details-marker]:hidden">
        <span className="text-[11px] uppercase tracking-[0.24em] text-[#ad9164]">
          Concierge intake
        </span>
        <span className="min-w-0 text-right text-[11px] leading-relaxed text-[#8d8073]">
          {submitted}
        </span>
      </summary>
      <div className="pb-6">
        {whatMatters ? (
          <section aria-label="What matters">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#8d8073]">
              What matters
            </p>
            <p className="mt-2 max-w-[44rem] font-serif text-[1.15rem] leading-relaxed tracking-[-0.015em] text-[#efe8de]">
              {whatMatters}
            </p>
          </section>
        ) : null}
        <dl className={`${whatMatters ? "mt-7" : ""} grid min-w-0 gap-x-8 gap-y-5 sm:grid-cols-2`}>
          {fields.map((field) => (
            <div
              key={field.key}
              className={`min-w-0 ${field.kind === "notes" ? "sm:col-span-2" : ""}`}
            >
              <dt className="text-[10px] uppercase tracking-[0.18em] text-[#8d8073]">
                {field.label}
              </dt>
              <dd>{fieldValue(field)}</dd>
            </div>
          ))}
          <div className="min-w-0">
            <dt className="text-[10px] uppercase tracking-[0.18em] text-[#8d8073]">
              Submitted
            </dt>
            <dd className="mt-1 break-words text-[15px] leading-relaxed text-[#efe8de]">
              {submitted}
            </dd>
          </div>
        </dl>
        <WebsiteIntakeControls intake={intake} />
      </div>
    </details>
  );
}
