import type { ReactNode } from "react";

export function ClientMemorySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
