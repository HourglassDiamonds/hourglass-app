/** Quiet trust strip between Concierge intro and form. */
export default function ConciergeTrustStrip() {
  const items = [
    "Graduate Gemologist-led",
    "Personally reviewed by Justin",
    "Charlotte-based, working nationwide",
    "Thoughtful response within 24 hours",
  ];

  return (
    <div
      className="mx-auto mt-10 max-w-[980px] border-y border-[#e4dbcf]/90 py-5 md:mt-12 md:py-6"
      aria-label="Why clients begin here"
    >
      <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-8 sm:gap-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="text-center text-[12px] leading-5 tracking-[0.04em] text-[#6f665d] md:text-[13px]"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
