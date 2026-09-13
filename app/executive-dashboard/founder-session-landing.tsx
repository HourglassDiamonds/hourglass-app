"use client";

import { useEffect } from "react";
import {
  CONTINUUM_DESKTOP_MEDIA_QUERY,
  founderDefaultLoginDestination,
} from "@/lib/continuum/operating-shell/login-destination";

export function FounderSessionLanding() {
  useEffect(() => {
    const viewport = window.matchMedia(CONTINUUM_DESKTOP_MEDIA_QUERY).matches
      ? "desktop"
      : "mobile";
    window.location.replace(founderDefaultLoginDestination(viewport));
  }, []);

  return (
    <main className="min-h-[100dvh] bg-[#14110f] text-[#efe8de]">
      <p className="sr-only">Continuing</p>
    </main>
  );
}
