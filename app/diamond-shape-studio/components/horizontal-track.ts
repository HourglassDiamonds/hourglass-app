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
 * Uses Pointer Events + setPointerCapture so dragging continues when the
 * finger moves above/below the visible track, and so track presses set the
 * value immediately without requiring a precise thumb grab.
 */
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

  const applyFromEvent = (clientX: number) => {
    applyPct(pctFromClientX(clientX, track.getBoundingClientRect()));
  };

  const onPointerDown = (ev: PointerEvent) => {
    if (ev.button !== 0 && ev.pointerType === "mouse") return;
    draggingRef.current = true;
    setDraggingUi(true);
    try {
      track.setPointerCapture(ev.pointerId);
    } catch {
      /* capture unsupported — window listeners still cover mouse */
    }
    applyFromEvent(ev.clientX);
    ev.preventDefault();
  };

  const onPointerMove = (ev: PointerEvent) => {
    if (!draggingRef.current) return;
    applyFromEvent(ev.clientX);
    ev.preventDefault();
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

  const onPointerUp = (ev: PointerEvent) => {
    endDrag(ev);
  };

  const onPointerCancel = (ev: PointerEvent) => {
    endDrag(ev);
  };

  const onLostCapture = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDraggingUi(false);
    onDragEnd?.();
  };

  track.addEventListener("pointerdown", onPointerDown);
  track.addEventListener("pointermove", onPointerMove);
  track.addEventListener("pointerup", onPointerUp);
  track.addEventListener("pointercancel", onPointerCancel);
  track.addEventListener("lostpointercapture", onLostCapture);

  return () => {
    setDraggingUi(false);
    draggingRef.current = false;
    track.removeEventListener("pointerdown", onPointerDown);
    track.removeEventListener("pointermove", onPointerMove);
    track.removeEventListener("pointerup", onPointerUp);
    track.removeEventListener("pointercancel", onPointerCancel);
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
