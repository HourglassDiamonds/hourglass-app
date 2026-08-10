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
  const mark = variant === "checks" ? "—" : "•";
  return (
    <ul className="grid list-none gap-[14px] p-0">
      {items.map((item) => (
        <li key={item} className="relative max-w-[62ch] pl-5 text-[15px] leading-[1.72] text-[#6f665b]">
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
      <p className="text-[11px] uppercase tracking-[0.15em] text-[#766a58]">
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
      <div className="grid gap-0">
        {ladder.map((tier) => {
          const meta = V3_TIER_DESCRIPTIONS[tier];
          const active = tier === activeTier;
          const label = displayV3PublicTierLabel(tier);
          return (
            <div
              key={tier}
              className={`border-b border-[rgba(58,48,38,0.12)] py-5 md:py-6 ${
                active
                  ? "border-l-[3px] border-l-[rgba(181,150,98,0.72)] pl-5 md:pl-6"
                  : "pl-5 opacity-[0.68] md:pl-6"
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <div
                  className={`font-serif leading-none text-[#1e1a16] ${
                    active
                      ? "text-[clamp(28px,4vw,36px)]"
                      : "text-[22px]"
                  }`}
                >
                  {label}
                </div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#b59662]">
                  {meta.range}
                </div>
              </div>
              {active ? (
                <p className="mt-3 max-w-[62ch] text-[15px] leading-[1.72] text-[#6f665b]">
                  {meta.description}
                </p>
              ) : (
                <p className="mt-2 max-w-[62ch] text-[13px] leading-[1.6] text-[#6d655e]">
                  {meta.description}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-7 max-w-[62ch] text-[14px] leading-[1.68] text-[#6d655e]">
        This assessment places the diamond in the{" "}
        {displayV3PublicTierLabel(activeTier)} range — a report-based
        classification, not a substitute for in-person confirmation.
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
      <div className="mb-6 rounded-none border border-[rgba(181,150,98,0.22)] bg-[rgba(255,255,255,0.14)] p-5 md:p-6">
        <p className="mb-5 text-[11px] uppercase tracking-[0.15em] text-[#766a58]">
          GCAL 8X Performance Class
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {tiers.map((tier) => {
            const active = tier.name === activeTier;
            return (
              <div
                key={tier.name}
                className={`min-h-[132px] rounded-[16px] border p-5 md:p-[22px] ${
                  active
                    ? "border-[rgba(181,150,98,0.58)] bg-[radial-gradient(circle_at_top_right,rgba(181,150,98,0.14),transparent_14rem),rgba(181,150,98,0.08)]"
                    : "border-[rgba(58,48,38,0.12)] bg-[rgba(255,255,255,0.18)] opacity-[0.68]"
                }`}
              >
                <div
                  className={`font-serif leading-none text-[#1e1a16] ${
                    active ? "text-[36px]" : "text-[28px]"
                  }`}
                >
                  {tier.name}
                </div>
                <p
                  className={`mt-3 leading-[1.58] text-[#6f665b] ${
                    active ? "text-[15px]" : "text-[13px]"
                  }`}
                >
                  {tier.copy}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid max-w-[62ch] gap-4 text-[14px] leading-[1.68] text-[#6d655e]">
        <p>
          GCAL 8X diamonds are measured against an already elite pool — not
          ordinary report-only stones.
        </p>
        <p>
          Rare does not mean no review is needed. It means the diamond begins
          from a verified performance class and reads strongly within it.
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
    <div className="grid gap-10 md:grid-cols-2 md:gap-8">
      <div>
        <h3 className="mb-4 text-[11px] uppercase tracking-[0.14em] text-[#766a58]">
          What Supports This Read
        </h3>
        <CleanList items={strengths} variant="checks" />
      </div>
      {limitations.length > 0 ? (
        <div>
          <h3 className="mb-4 text-[11px] uppercase tracking-[0.14em] text-[#756a5f]">
            {limitationTitle}
          </h3>
          <CleanList items={limitations} variant="dots" />
        </div>
      ) : null}
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
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.13em] text-[#766a58]">
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
