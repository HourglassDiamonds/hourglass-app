import Link from "next/link";
import type { GuideBreadcrumbItem } from "@/lib/diamond-guide/guide-nav";

type GuideBreadcrumbsProps = {
  items: GuideBreadcrumbItem[];
  align?: "center" | "start";
};

export default function GuideBreadcrumbs({
  items,
  align = "center",
}: GuideBreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-8">
      <ol
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.22em] text-[#6d655e] ${
          align === "start" ? "justify-start" : "justify-center"
        }`}
      >
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.name}-${index}`} className="flex items-center gap-2">
              {index > 0 ? (
                <span aria-hidden="true" className="text-[#c4bbb0]">
                  /
                </span>
              ) : null}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="transition-colors duration-300 hover:text-[#1d1b18]"
                >
                  {item.name}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "text-[#8a8279] normal-case tracking-[0.08em]" : undefined}
                >
                  {item.name}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
