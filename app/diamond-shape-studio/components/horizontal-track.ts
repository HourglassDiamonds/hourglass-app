"use client";

import { useEffect, useRef } from "react";

export function attachHorizontalTrack(
  track: HTMLDivElement,
  draggingRef: React.MutableRefObject<boolean>,
  applyPct: (pct: number) => void,
  onDragEnd?: () => void,
) {
  const shell = () =>
    track.closest<HTMLElement>("[data-shape-studio-instrument]");

  const setDraggingUi = (active: boolean) => {
    track.classList.toggle("is-dragging", active);
    track.toggleAttribute("data-dss-slider-dragging", active);
    const host = shell();
    if (!host) return;
    if (active) host.setAttribute("data-slider-adjusting", "");
    else host.removeAttribute("data-slider-adjusting");
  };

  const readPct = (clientX: number) => {
    const r = track.getBoundingClientRect();
    const x = clientX - r.left;
    return Math.max(0, Math.min(1, x / r.width));
  };
  const down = (ev: MouseEvent | TouchEvent) => {
    draggingRef.current = true;
    setDraggingUi(true);
    const cx = "touches" in ev ? ev.touches[0]!.clientX : ev.clientX;
    applyPct(readPct(cx));
    ev.preventDefault();
  };
  const move = (ev: MouseEvent | TouchEvent) => {
    if (!draggingRef.current) return;
    const cx = "touches" in ev ? ev.touches[0]!.clientX : ev.clientX;
    applyPct(readPct(cx));
    if ("touches" in ev) ev.preventDefault();
  };
  const up = () => {
    if (draggingRef.current) {
      onDragEnd?.();
    }
    draggingRef.current = false;
    setDraggingUi(false);
  };
  track.addEventListener("mousedown", down);
  track.addEventListener("touchstart", down, { passive: false });
  window.addEventListener("mousemove", move);
  window.addEventListener("touchmove", move, { passive: false });
  window.addEventListener("mouseup", up);
  window.addEventListener("touchend", up);
  return () => {
    setDraggingUi(false);
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
