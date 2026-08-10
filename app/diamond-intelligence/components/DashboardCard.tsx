import type { ReactNode } from "react";
import {
  DI_EYEBROW,
  DI_EYEBROW_ACCENT,
  DI_EYEBROW_MUTED,
} from "./di-editorial-classes";

const CARD_BASE = "rounded-xl border bg-white/50";

const TONE_STYLES = {
  primary:
    "border-[#d4c4a8]/35 bg-[#fdfbf7]/95 shadow-[0_8px_28px_rgba(168,146,106,0.06)] ring-1 ring-[#e8dcc8]/30",
  default:
    "border-[#e4dbcf]/40 shadow-[0_2px_14px_rgba(48,36,28,0.025)]",
  subdued:
    "border-[#ebe4da]/38 bg-white/32 shadow-none ring-0",
  secondary:
    "border-[#e4dbcf]/42 bg-white/40 shadow-[0_2px_12px_rgba(48,36,28,0.02)]",
} as const;

export function DashboardCard({
  title,
  children,
  className = "",
  tone = "default",
  variant = "card",
  titleClassName = "",
  contentClassName = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
  tone?: keyof typeof TONE_STYLES;
  /** card = bordered container; editorial = borderless section; minimal = sidebar utility */
  variant?: "card" | "editorial" | "minimal";
  titleClassName?: string;
  contentClassName?: string;
}) {
  const titleColor =
    tone === "subdued"
      ? DI_EYEBROW_MUTED
      : tone === "primary"
        ? DI_EYEBROW_ACCENT
        : DI_EYEBROW;

  if (variant === "editorial") {
    return (
      <section
        className={`border-t border-[#e4dbcf]/30 py-10 first:border-t-0 first:pt-0 md:py-14 ${className}`}
      >
        <h3 className={`${titleColor} ${titleClassName}`}>{title}</h3>
        <div className={`mt-6 md:mt-8 ${contentClassName}`}>{children}</div>
      </section>
    );
  }

  if (variant === "minimal") {
    return (
      <section
        className={`rounded-lg border border-[#ebe4da]/30 bg-white/25 px-4 py-4 md:px-5 md:py-5 ${className}`}
      >
        <h3 className={`${titleColor} ${titleClassName}`}>{title}</h3>
        <div className={`mt-3.5 ${contentClassName}`}>{children}</div>
      </section>
    );
  }

  return (
    <section
      className={`${CARD_BASE} ${TONE_STYLES[tone]} p-5 md:p-6 lg:p-7 ${className}`}
    >
      <h3 className={`${titleColor} ${titleClassName}`}>{title}</h3>
      <div className={`mt-5 ${contentClassName}`}>{children}</div>
    </section>
  );
}

export function MetricRow({
  label,
  value,
  editorial,
}: {
  label: string;
  value: string;
  editorial?: boolean;
}) {
  if (editorial) {
    return (
      <div className="flex justify-between gap-6 border-b border-[#ebe4da]/35 py-3 last:border-0">
        <span className="text-[13px] leading-relaxed text-[#6f665d]">{label}</span>
        <span className="shrink-0 text-right text-[13px] leading-relaxed font-medium tracking-[-0.01em] text-[#1f1d1a]">
          {value}
        </span>
      </div>
    );
  }

  return (
    <div className="flex justify-between gap-4 border-b border-[#ebe4da]/40 py-2.5 text-[13px] last:border-0">
      <span className="text-[#6d655e]">{label}</span>
      <span className="shrink-0 text-right font-medium tracking-[-0.01em] text-[#1f1d1a]">
        {value}
      </span>
    </div>
  );
}

export function dashValue(raw: string | undefined): string {
  const v = raw?.trim();
  return v ? v : "—";
}
