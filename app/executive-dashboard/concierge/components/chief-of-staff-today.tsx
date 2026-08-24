import type { ContinuumHomeModel } from "@/lib/continuum/dashboard/types";

export function ChiefOfStaffToday({
  chiefOfStaff,
}: {
  chiefOfStaff: ContinuumHomeModel["chiefOfStaff"];
}) {
  const items = chiefOfStaff.items;

  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
        Chief of Staff
      </h2>
      <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-[#8d8073]">
        Today
      </p>
      {items.length === 0 ? (
        <>
          <p className="mt-5 max-w-[22ch] font-serif text-[1.7rem] font-normal leading-[1.12] tracking-[-0.035em] text-[#efe8de] md:text-[1.9rem]">
            Nothing in memory needs your attention yet.
          </p>
          <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-[#9a8e82]">
            As relationship signals come online, the few things that matter will
            appear here.
          </p>
        </>
      ) : (
        <ul className="mt-5 space-y-5">
          {items.map((item) => (
            <li key={item.id}>
              <p className="font-serif text-[1.35rem] leading-[1.15] tracking-[-0.03em] text-[#efe8de]">
                {item.title}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-[#9a8e82]">
                {item.summary}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
