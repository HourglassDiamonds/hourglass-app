import type { CalendarFounderEventView } from "@/lib/continuum/calendar/presentation";

function EventList({
  heading,
  empty,
  events,
}: {
  heading: string;
  empty: string;
  events: readonly CalendarFounderEventView[];
}) {
  return (
    <section className="mt-10">
      <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
        {heading}
      </h2>
      {events.length === 0 ? (
        <p className="mt-4 text-[15px] leading-relaxed text-[#c4b7aa]">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-5">
          {events.map((event) => (
            <li key={event.source_ref}>
              <p className="text-[16px] leading-snug text-[#efe8de]">{event.title}</p>
              <p className="mt-1 text-[13px] text-[#c4b7aa]">
                {event.when_label}
                <span className="text-[#8d8073]"> · {event.timezone}</span>
              </p>
              <p className="mt-1 text-[12px] uppercase tracking-[0.16em] text-[#8d8073]">
                {event.status_label}
                {event.occurrence_label ? ` · ${event.occurrence_label}` : ""}
              </p>
              {event.location ? (
                <p className="mt-1 text-[13px] text-[#c4b7aa]">{event.location}</p>
              ) : null}
              {event.conference_label ? (
                <p className="mt-1 text-[13px] text-[#c4b7aa]">{event.conference_label}</p>
              ) : null}
              {event.attendees.length > 0 ? (
                <p className="mt-1 text-[13px] text-[#c4b7aa]">
                  {event.attendees.join(", ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CalendarContextSurface({
  upcoming,
  recent,
}: {
  upcoming: readonly CalendarFounderEventView[];
  recent: readonly CalendarFounderEventView[];
}) {
  return (
    <div data-calendar-context>
      <EventList
        heading="Coming up"
        empty="Nothing coming up in the next two weeks."
        events={upcoming}
      />
      <EventList
        heading="Recently"
        empty="Nothing in the past week."
        events={recent}
      />
    </div>
  );
}
