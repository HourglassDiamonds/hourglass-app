import type { ReactNode } from "react";

const CARD =
  "rounded-lg border border-[#e4dbcf]/70 bg-white/55 shadow-[0_8px_28px_rgba(48,36,28,0.04)]";

export function DashboardCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${CARD} p-5 md:p-6 ${className}`}>
      <h3 className="text-[10px] uppercase tracking-[0.32em] text-[#948a80]">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
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
