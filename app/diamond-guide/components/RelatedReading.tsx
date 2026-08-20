import Link from "next/link";
import type { RelatedReading } from "@/lib/diamond-guide/guide-nav";

type RelatedReadingSectionProps = {
  reading: RelatedReading;
  compact?: boolean;
};

export default function RelatedReadingSection({
  reading,
  compact = false,
}: RelatedReadingSectionProps) {
  const items = reading.articles;
  if (items.length === 0 && !reading.studio) return null;

  return (
    <section
      className={`border-t border-[#e4dbcf]/55 ${
        compact ? "mt-16 pt-10" : "mt-20 pt-12 md:mt-24 md:pt-14"
      }`}
    >
      <p className="text-[9px] font-normal uppercase tracking-[0.38em] text-[#6d655e]">
        Related topics
      </p>
      <h2 className="mt-2 font-serif text-[1.2rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.28rem]">
        Continue Exploring
      </h2>

      <ul className="mt-7 flex flex-col divide-y divide-[#ebe4da]/35">
        {items.map((item) => (
          <li key={item.href} className="py-[1.15rem] first:pt-0">
            <Link
              href={item.href}
              className="group block no-underline transition-colors duration-300"
            >
              <span className="font-serif text-[1.02rem] tracking-[-0.01em] text-[#3a3632] transition-colors duration-300 group-hover:text-[#1f1d1a]">
                {item.title}
              </span>
            </Link>
          </li>
        ))}
        {reading.studio ? (
          <li className="py-[1.15rem]">
            <Link
              href={reading.studio.href}
              className="group block no-underline transition-colors duration-300"
            >
              <span className="text-[9px] uppercase tracking-[0.32em] text-[#6d655e]">
                Diamond Studio
              </span>
              <span className="mt-1.5 block font-serif text-[1.02rem] tracking-[-0.01em] text-[#3a3632] transition-colors duration-300 group-hover:text-[#1f1d1a]">
                {reading.studio.title}
              </span>
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
