"use client";

type SubscribeSectionProps = {
  id?: string;
  className?: string;
};

export default function SubscribeSection({
  id,
  className = "",
}: SubscribeSectionProps) {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: Wire HubSpot newsletter form — mirror concierge field mapping when API is ready.
  };

  return (
    <section
      id={id}
      className={`ledger-subscribe border-t border-[#e4dbcf] ${className}`}
      aria-labelledby="ledger-subscribe-heading"
    >
      <div className="mx-auto max-w-[36rem] text-center">
        <h2
          id="ledger-subscribe-heading"
          className="font-serif text-[1.5rem] font-normal leading-[1.2] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.75rem]"
        >
          Receive the weekly Ledger brief.
        </h2>
        <p className="mt-4 text-[0.95rem] leading-[1.85] text-[#6f6760]">
          A calm signal on pressure across markets and systems — delivered once a
          week. No noise, no urgency theater.
        </p>

        <form
          className="mx-auto mt-8 flex max-w-[28rem] flex-col gap-3 sm:max-w-[32rem] sm:flex-row sm:items-stretch sm:justify-center"
          onSubmit={handleSubmit}
          noValidate
        >
          {/* TODO: HubSpot — hidden portal ID, form GUID, and consent fields */}
          <label htmlFor="ledger-email" className="sr-only">
            Email address
          </label>
          <input
            id="ledger-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Email address"
            className="min-w-0 flex-1 rounded-sm border border-[#d8cfc3] bg-[#faf7f2]/80 px-4 py-3 text-[0.9rem] text-[#1f1d1a] placeholder:text-[#a39a90] focus:border-[#b8a690] focus:outline-none focus:ring-1 focus:ring-[#b8a690]/40 sm:min-w-[15rem]"
          />
          <button
            type="submit"
            className="shrink-0 rounded-sm border border-[#3a3632] bg-[#2f2b27] px-6 py-[10px] text-[10px] uppercase tracking-[0.28em] text-[#faf7f2] transition-colors hover:bg-[#1f1d1a]"
          >
            Subscribe
          </button>
        </form>
      </div>
    </section>
  );
}
