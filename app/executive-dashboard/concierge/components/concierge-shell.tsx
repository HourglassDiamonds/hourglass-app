import type { ReactNode } from "react";
import Link from "next/link";
import { CONCIERGE_HOME_PATH } from "@/lib/continuum/client-memory/read/presentation";
import { CONTINUUM_APP_NAME } from "@/lib/continuum/pwa/config";

export type ConciergeShellVariant = "home" | "document";

export function ConciergeShell({
  children,
  footer,
  variant = "document",
}: {
  children: ReactNode;
  footer?: ReactNode;
  variant?: ConciergeShellVariant;
}) {
  const frame =
    variant === "home"
      ? "relative mx-auto w-full max-w-[34rem] px-5 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(1.1rem,env(safe-area-inset-top))] md:max-w-[75rem] md:px-8 md:pt-10"
      : "relative mx-auto w-full max-w-[34rem] px-5 pb-[max(4rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] md:max-w-[38rem] md:px-8 md:pt-14";

  return (
    <div
      data-concierge-shell
      data-concierge-variant={variant}
      className="relative min-h-[100dvh] overflow-x-hidden bg-[#14110f] text-[#efe8de]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,_rgba(173,145,100,0.08),_transparent_58%)]"
      />
      <div className={frame}>
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
          <Link
            href={CONCIERGE_HOME_PATH}
            className="inline-flex min-h-11 items-center outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
          >
            {CONTINUUM_APP_NAME}
          </Link>
        </p>
        {children}
        {footer}
      </div>
    </div>
  );
}
