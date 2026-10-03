"use client";

import Link from "next/link";
import { useSyncExternalStore, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import {
  contextualBackLabel,
  destinationBackForPath,
  isConciergeInteriorPath,
  normalizeConciergePath,
} from "@/lib/continuum/operating-shell/destinations";
import {
  CONCIERGE_HISTORY_EVENT,
  CONCIERGE_PREVIOUS_PATH_KEY,
} from "./concierge-navigation-history";

function subscribeToHistory(onStoreChange: () => void) {
  window.addEventListener(CONCIERGE_HISTORY_EVENT, onStoreChange);
  return () => window.removeEventListener(CONCIERGE_HISTORY_EVENT, onStoreChange);
}

function readPreviousPath(pathname: string) {
  const saved = window.sessionStorage.getItem(CONCIERGE_PREVIOUS_PATH_KEY);
  if (!saved) return null;
  try {
    const navigation = JSON.parse(saved) as { from?: unknown; to?: unknown };
    if (
      typeof navigation.from !== "string" ||
      typeof navigation.to !== "string" ||
      !isConciergeInteriorPath(navigation.from) ||
      normalizeConciergePath(navigation.to) !== normalizeConciergePath(pathname)
    ) {
      return null;
    }
    return navigation.from;
  } catch {
    return null;
  }
}

export function ConciergeBackLink({
  href,
  label,
}: {
  href?: string;
  label?: string;
}) {
  const pathname = usePathname() ?? "";
  const inferred = destinationBackForPath(pathname);
  const target = href ?? inferred.href;
  const previousPath = useSyncExternalStore(
    subscribeToHistory,
    () => readPreviousPath(pathname),
    () => null,
  );

  const text = label ?? contextualBackLabel(pathname, previousPath) ?? inferred.label;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !previousPath ||
      window.history.length <= 1
    ) {
      return;
    }
    event.preventDefault();
    window.history.back();
  }

  return (
    <Link
      href={target}
      onClick={handleClick}
      data-concierge-history-back="true"
      aria-label={`Back to ${text}`}
      className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
    >
      ← {text}
    </Link>
  );
}
