import Link from "next/link";
import type { ReactNode } from "react";

type WhisperedPraiseLinkProps = {
  children: ReactNode;
  className?: string;
  /** Inline text link vs quiet arrow-style editorial link */
  variant?: "inline" | "arrow";
};

const inlineClass =
  "border-b border-[#d4c8ba]/75 text-[#6a635c] decoration-0 transition-[color,border-color] duration-500 hover:border-[#b8a896] hover:text-[#3d3832]";

const arrowClass =
  "text-[#8a8176] transition-colors duration-500 hover:text-[#4a443e]";

export default function WhisperedPraiseLink({
  children,
  className = "",
  variant = "inline",
}: WhisperedPraiseLinkProps) {
  return (
    <Link
      href="/whispered-praise"
      className={`${variant === "inline" ? inlineClass : arrowClass} ${className}`.trim()}
    >
      {children}
    </Link>
  );
}
