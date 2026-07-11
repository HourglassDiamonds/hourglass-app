"use client";

import { useEffect, useRef } from "react";

/** Map a client X into 0–1 along a horizontal track rect. */
export function pctFromClientX(
  clientX: number,
  rect: Pick<DOMRect, "left" | "width">,
): number {
  if (rect.width <= 0) return 0;
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
}

/**
 * Horizontal press-to-set + drag for Scaled Preview sliders.
 *
 * Pointer-down is acquired on the track (large mobile hit band). Move/up are
 * listened on `window` — same pattern as Diamond Size Studio — so iOS Safari
 * keeps the gesture when the finger leaves the visible track even if
 * setPointerCapture is unreliable.
 */
export function attachHorizontalTrack(
  track: HTMLDivElement,
  draggingRef: React.MutableRefObject<boolean>,
  applyPct: (pct: number) => void,
  onDragEnd?: () => void,
) {
  const shell = () =>
    track.closest<HTMLElement>("[data-shape-studio-instrument]");

  const dragRoot: EventTarget =
    typeof window !== "undefined" ? window : track;

  const setDraggingUi = (active: boolean) => {
    track.classList.toggle("is-dragging", active);
    track.toggleAttribute("data-dss-slider-dragging", active);
    const host = shell();
    if (!host) return;
    if (active) host.setAttribute("data-slider-adjusting", "");
    else host.removeAttribute("data-slider-adjusting");
  };

  const applyFromEvent = (clientX: number) => {
    applyPct(pctFromClientX(clientX, track.getBoundingClientRect()));
  };

  const onPointerDown = (ev: Event) => {
    const e = ev as PointerEvent;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    draggingRef.current = true;
    setDraggingUi(true);
    try {
      track.setPointerCapture(e.pointerId);
    } catch {
      /* capture optional — window move listeners are the reliable path */
    }
    applyFromEvent(e.clientX);
    e.preventDefault();
  };

  const onPointerMove = (ev: Event) => {
    if (!draggingRef.current) return;
    const e = ev as PointerEvent;
    applyFromEvent(e.clientX);
    e.preventDefault();
  };

  const endDrag = (ev?: PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDraggingUi(false);
    if (ev) {
      try {
        if (track.hasPointerCapture?.(ev.pointerId)) {
          track.releasePointerCapture(ev.pointerId);
        }
      } catch {
        /* ignore */
      }
    }
    onDragEnd?.();
  };

  const onPointerUp = (ev: Event) => {
    endDrag(ev as PointerEvent);
  };

  const onPointerCancel = (ev: Event) => {
    endDrag(ev as PointerEvent);
  };

  const onLostCapture = () => {
    /* Keep dragging via window listeners until pointerup/cancel. */
  };

  track.addEventListener("pointerdown", onPointerDown);
  dragRoot.addEventListener("pointermove", onPointerMove);
  dragRoot.addEventListener("pointerup", onPointerUp);
  dragRoot.addEventListener("pointercancel", onPointerCancel);
  track.addEventListener("lostpointercapture", onLostCapture);

  return () => {
    setDraggingUi(false);
    draggingRef.current = false;
    track.removeEventListener("pointerdown", onPointerDown);
    dragRoot.removeEventListener("pointermove", onPointerMove);
    dragRoot.removeEventListener("pointerup", onPointerUp);
    dragRoot.removeEventListener("pointercancel", onPointerCancel);
    track.removeEventListener("lostpointercapture", onLostCapture);
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
