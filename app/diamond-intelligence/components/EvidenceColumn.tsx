import { DI_SERIF_HEADLINE } from "./di-studio-styles";

export default function EvidenceColumn({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className={`${DI_SERIF_HEADLINE} text-2xl leading-snug md:text-[1.65rem]`}>
        {title}
      </h3>
      <ul className="mt-5 space-y-4 text-[15px] leading-7 text-[#5f5148]">
        {items.map((item) => (
          <li key={item} className="max-w-2xl">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
