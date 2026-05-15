"use client";

import { useEffect } from "react";

const DESKTOP_MQ = "(min-width: 769px)";
const LOCK_CLASS = "diamond-studio-viewport-lock";

/** Stops document scroll behind the fixed Diamond Studio shell (desktop only). */
export function DiamondStudioViewportLock() {
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const sync = () => {
      document.documentElement.classList.toggle(LOCK_CLASS, mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      document.documentElement.classList.remove(LOCK_CLASS);
      mq.removeEventListener("change", sync);
    };
  }, []);

  return null;
}
