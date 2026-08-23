import type { ReactNode } from "react";

export function ConciergeShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      data-concierge-shell
      className="relative min-h-screen overflow-x-hidden bg-[#14110f] text-[#efe8de]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,_rgba(173,145,100,0.08),_transparent_58%)]"
      />
      <div className="relative mx-auto w-full max-w-[34rem] px-5 pb-[max(4rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] md:max-w-[38rem] md:px-8 md:pt-14">
        {children}
        {footer}
      </div>
    </div>
  );
}
