import type { V3Gcal8xTier, V3PublicTier } from "./v3-presentation";
import { V3_TIER_DESCRIPTIONS, standardTierLadder } from "./v3-presentation";
import { displayV3PublicTierLabel } from "@/lib/diamond-intelligence/v3-editorial-narrative";
import { HOURGLASS_EXCLUDED_SPECTRUM_STATUS } from "@/lib/diamond-intelligence/hourglass-clarity-policy";

function CleanList({
  items,
  variant,
}: {
  items: string[];
  variant: "checks" | "dots";
}) {
  const mark = variant === "checks" ? "✓" : "•";
  return (
    <ul className="grid list-none gap-3 p-0">
      {items.map((item) => (
        <li key={item} className="relative pl-6 text-[#6f665b]">
          <span className="absolute left-0 text-[#b59662]">{mark}</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function DiV3ExcludedClarityStatus() {
  const status = HOURGLASS_EXCLUDED_SPECTRUM_STATUS;

  return (
    <div className="max-w-[620px] rounded-[22px] border border-[rgba(58,48,38,0.22)] bg-[rgba(255,255,255,0.28)] p-6 md:p-8">
      <p className="text-[11px] uppercase tracking-[0.15em] text-[#9b8b78]">
        {status.title}
      </p>
      <p className="mt-4 font-serif text-[clamp(32px,5vw,44px)] leading-none text-[#1e1a16]">
        {status.verdict}
      </p>
      <p className="mt-5 max-w-[56ch] text-[15px] leading-[1.72] text-[#6f665b]">
        {status.body}
      </p>
    </div>
  );
}

export function DiV3StandardSpectrum({
  activeTier,
}: {
  activeTier: V3PublicTier;
}) {
  const ladder = standardTierLadder();

  return (
    <>
      <div className="mb-7 grid max-w-[560px] gap-4">
        {ladder.map((tier) => {
          const active = tier === activeTier;
          const label = displayV3PublicTierLabel(tier);
          return (
            <div
              key={tier}
              className={`grid grid-cols-[98px_1fr_28px] items-center gap-3.5 text-sm md:grid-cols-[120px_1fr_34px] ${
                active
                  ? "font-serif text-[25px] text-[#1e1a16]"
                  : "text-[#6f665b]"
              }`}
            >
              <span>{label}</span>
              <span className="h-px bg-[linear-gradient(90deg,rgba(181,150,98,.55),rgba(58,48,38,.08))]" />
              <span className="flex justify-end">
                {active ? (
                  <span className="h-[13px] w-[13px] rounded-full bg-[#b59662] shadow-[0_0_0_8px_rgba(181,150,98,0.12)]" />
                ) : null}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mb-6 grid gap-0">
        {ladder.map((tier) => {
          const meta = V3_TIER_DESCRIPTIONS[tier];
          const active = tier === activeTier;
          const label = displayV3PublicTierLabel(tier);
          return (
            <div
              key={tier}
              className={`grid gap-2.5 border-b border-[rgba(58,48,38,0.18)] py-[18px] md:grid-cols-[132px_1fr] md:gap-[22px] ${
                active
                  ? "-mx-5 border border-[rgba(181,150,98,0.35)] bg-[rgba(181,150,98,0.08)] px-5 py-5 md:-mx-5"
                  : ""
              }`}
            >
              <div>
                <div className="font-serif text-[26px] leading-none text-[#1e1a16]">
                  {label}
                </div>
                <div className="mt-2 text-[11px] uppercase tracking-[0.13em] text-[#b59662]">
                  {meta.range}
                </div>
              </div>
              <p className="text-[14.5px] leading-[1.62] text-[#6f665b]">
                {meta.description}
              </p>
            </div>
          );
        })}
      </div>

      <p className="max-w-[68ch]">
        This assessment places the diamond inside the {displayV3PublicTierLabel(activeTier)} range. From a
        client perspective, that means this is worth serious consideration when
        the price and visual inspection support the paper. From a gemological
        perspective, it means the report supports a favorable read, but does not
        replace optical confirmation.
      </p>
    </>
  );
}

export function DiV3Gcal8xSpectrum({
  activeTier,
}: {
  activeTier: V3Gcal8xTier | null;
}) {
  if (!activeTier) return null;

  const tiers: { name: V3Gcal8xTier; copy: string }[] = [
    {
      name: "Exceptional",
      copy: "An elite 8X diamond with meaningful optical support, while still benefiting from comparison against other top candidates.",
    },
    {
      name: "Rare",
      copy: "A verified 8X diamond that reads as a high-confidence performance candidate within an already elite class.",
    },
  ];

  return (
    <>
      <div className="mb-7 rounded-none border border-[rgba(181,150,98,0.32)] bg-[radial-gradient(circle_at_top_left,rgba(181,150,98,0.14),transparent_24rem),rgba(255,255,255,0.18)] p-6">
        <p className="mb-5 text-[11px] uppercase tracking-[0.15em] text-[#9b8b78]">
          GCAL 8X Performance Class
        </p>
        <div className="grid gap-3.5 md:grid-cols-2">
          {tiers.map((tier) => {
            const active = tier.name === activeTier;
            return (
              <div
                key={tier.name}
                className={`min-h-[138px] rounded-[18px] border p-[22px] ${
                  active
                    ? "border-[rgba(181,150,98,0.58)] bg-[radial-gradient(circle_at_top_right,rgba(181,150,98,0.16),transparent_14rem),rgba(181,150,98,0.10)] shadow-[inset_0_0_0_1px_rgba(181,150,98,0.10)]"
                    : "border-[rgba(58,48,38,0.18)] bg-[rgba(255,255,255,0.22)]"
                }`}
              >
                <div className="font-serif text-[36px] leading-none text-[#1e1a16]">
                  {tier.name}
                </div>
                <p className="mt-3 text-sm leading-[1.58] text-[#6f665b]">
                  {tier.copy}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid max-w-[68ch] gap-[18px]">
        <p>
          GCAL 8X diamonds are not being measured against the same starting pool
          as standard report-only diamonds.
        </p>
        <p>
          Rare does not mean no review is needed. It means the diamond begins
          from an elite performance-verified category and reads strongly within
          that category.
        </p>
        <p>
          The Diamond Intelligence read here determines whether the individual
          diamond is best presented as Rare or Exceptional within that elite
          class.
        </p>
      </div>
    </>
  );
}

export function DiV3StrengthColumns({
  strengths,
  limitations,
  limitationTitle,
}: {
  strengths: string[];
  limitations: string[];
  limitationTitle: string;
}) {
  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-[34px]">
      <div>
        <h3 className="mb-3.5 text-[11px] uppercase tracking-[0.14em] text-[#9b8b78]">
          Strengths
        </h3>
        <CleanList items={strengths} variant="checks" />
      </div>
      <div>
        <h3 className="mb-3.5 text-[11px] uppercase tracking-[0.14em] text-[#9b8b78]">
          {limitationTitle}
        </h3>
        <CleanList items={limitations} variant="dots" />
      </div>
    </div>
  );
}

export function DiV3BodyParagraphs({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="grid max-w-[68ch] gap-[18px]">
      {paragraphs.map((p) => (
        <p key={p.slice(0, 48)}>{p}</p>
      ))}
    </div>
  );
}

export function DiV3DataGrid({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <div className="grid max-w-[760px] grid-cols-1 gap-x-[26px] gap-y-3.5 sm:grid-cols-2">
      {items.map(({ label, value }) => (
        <div
          key={label}
          className="border-b border-[rgba(58,48,38,0.18)] pb-3"
        >
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.13em] text-[#9b8b78]">
            {label}
          </div>
          <div className="font-serif text-2xl leading-tight text-[#1e1a16]">
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
