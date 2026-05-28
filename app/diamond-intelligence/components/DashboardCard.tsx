import type { ReactNode } from "react";

const CARD_BASE = "rounded-lg border bg-white/55";

const TONE_STYLES = {
  primary:
    "border-[#d4c4a8]/50 shadow-[0_10px_32px_rgba(168,146,106,0.07)] ring-1 ring-[#e8dcc8]/40 bg-[#fdfbf7]/90",
  default:
    "border-[#e4dbcf]/55 shadow-[0_4px_18px_rgba(48,36,28,0.02)]",
  subdued:
    "border-[#ebe4da]/45 bg-white/28 shadow-none ring-0",
} as const;

export function DashboardCard({
  title,
  children,
  className = "",
  tone = "default",
  titleClassName = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
  tone?: keyof typeof TONE_STYLES;
  titleClassName?: string;
}) {
  return (
    <section
      className={`${CARD_BASE} ${TONE_STYLES[tone]} p-5 md:p-6 ${className}`}
    >
      <h3
        className={`text-[10px] uppercase tracking-[0.28em] ${
          tone === "subdued" ? "text-[#b8afa6]" : "text-[#948a80]"
        } ${titleClassName}`}
      >
        {title}
      </h3>
      <div className="mt-4">{children}</div>
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
      <div className="flex justify-between gap-6 border-b border-[#ebe4da]/50 py-3 last:border-0">
        <span className="text-[13px] leading-relaxed text-[#6f665d]">{label}</span>
        <span className="shrink-0 text-right text-[13px] leading-relaxed font-medium text-[#1f1d1a]">
          {value}
        </span>
      </div>
    );
  }

  return (
    <div className="flex justify-between gap-4 border-b border-[#ebe4da]/80 py-2.5 text-sm last:border-0">
      <span className="text-[#6f665d]">{label}</span>
      <span className="shrink-0 text-right font-medium text-[#1f1d1a]">
        {value}
      </span>
    </div>
  );
}

export function dashValue(raw: string | undefined): string {
  const v = raw?.trim();
  return v ? v : "—";
}
