"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { normalizeConciergePath } from "@/lib/continuum/operating-shell/destinations";

export const CONCIERGE_PREVIOUS_PATH_KEY = "continuum:previous-path";
export const CONCIERGE_HISTORY_EVENT = "continuum:navigation-history";

const CONCIERGE_ROOT = "/executive-dashboard/concierge";

export function ConciergeNavigationHistory() {
  const pathname = usePathname() ?? "";

  useEffect(() => {
    const currentPath = normalizeConciergePath(pathname);

    function rememberOrigin(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.dataset.conciergeHistoryBack === "true") return;
      if (anchor.target && anchor.target !== "_self") return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname !== CONCIERGE_ROOT &&
        !destination.pathname.startsWith(`${CONCIERGE_ROOT}/`)
      ) {
        return;
      }
      if (normalizeConciergePath(destination.pathname) === currentPath) return;

      window.sessionStorage.setItem(
        CONCIERGE_PREVIOUS_PATH_KEY,
        JSON.stringify({
          from: currentPath,
          to: normalizeConciergePath(destination.pathname),
        }),
      );
      window.dispatchEvent(new Event(CONCIERGE_HISTORY_EVENT));
    }

    document.addEventListener("click", rememberOrigin, true);
    return () => document.removeEventListener("click", rememberOrigin, true);
  }, [pathname]);

  return null;
}
