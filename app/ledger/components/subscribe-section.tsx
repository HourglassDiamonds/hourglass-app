import LedgerSignup from "./ledger-signup";

type SubscribeSectionProps = {
  id?: string;
  className?: string;
};

export default function SubscribeSection({
  id,
  className = "",
}: SubscribeSectionProps) {
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

        <LedgerSignup />
      </div>
    </section>
  );
}
