"use client";

import { useEffect, useRef } from "react";

export function attachHorizontalTrack(
  track: HTMLDivElement,
  draggingRef: React.MutableRefObject<boolean>,
  applyPct: (pct: number) => void,
  onDragEnd?: () => void,
) {
  const readPct = (clientX: number) => {
    const r = track.getBoundingClientRect();
    const x = clientX - r.left;
    return Math.max(0, Math.min(1, x / r.width));
  };
  const down = (ev: MouseEvent | TouchEvent) => {
    draggingRef.current = true;
    const cx = "touches" in ev ? ev.touches[0]!.clientX : ev.clientX;
    applyPct(readPct(cx));
    ev.preventDefault();
  };
  const move = (ev: MouseEvent | TouchEvent) => {
    if (!draggingRef.current) return;
    const cx = "touches" in ev ? ev.touches[0]!.clientX : ev.clientX;
    applyPct(readPct(cx));
  };
  const up = () => {
    if (draggingRef.current) {
      onDragEnd?.();
    }
    draggingRef.current = false;
  };
  track.addEventListener("mousedown", down);
  track.addEventListener("touchstart", down, { passive: false });
  window.addEventListener("mousemove", move);
  window.addEventListener("touchmove", move, { passive: true });
  window.addEventListener("mouseup", up);
  window.addEventListener("touchend", up);
  return () => {
    track.removeEventListener("mousedown", down);
    track.removeEventListener("touchstart", down);
    window.removeEventListener("mousemove", move);
    window.removeEventListener("touchmove", move);
    window.removeEventListener("mouseup", up);
    window.removeEventListener("touchend", up);
  };
}

export function useHorizontalTrack(
  trackRef: React.RefObject<HTMLDivElement | null>,
  applyPct: (pct: number) => void,
) {
  const draggingRef = useRef(false);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    return attachHorizontalTrack(el, draggingRef, applyPct);
  }, [trackRef, applyPct]);
}
