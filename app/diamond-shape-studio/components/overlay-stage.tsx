"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { shapeAssetPath } from "@/lib/shape-studio/constants";
import { overlaySizePx } from "@/lib/shape-studio/overlay-scale";
import type { DiamondSlotState, OverlayPosition } from "@/lib/shape-studio/types";

type OverlayLayerProps = {
  slot: DiamondSlotState;
  ringSize: number;
  stageWidthPx: number;
  label?: string;
  onPositionChange: (position: OverlayPosition) => void;
};

function OverlayLayer({
  slot,
  ringSize,
  stageWidthPx,
  label,
  onPositionChange,
}: OverlayLayerProps) {
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const { widthPx, heightPx } = overlaySizePx(
    slot.shape,
    slot.carat,
    ringSize,
    stageWidthPx,
  );

  const beginDrag = useCallback(
    (clientX: number, clientY: number) => {
      const stage = overlayRef.current?.parentElement;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const centerX = rect.left + (slot.position.xPct / 100) * rect.width;
      const centerY = rect.top + (slot.position.yPct / 100) * rect.height;
      draggingRef.current = true;
      dragOffsetRef.current = { x: clientX - centerX, y: clientY - centerY };
      overlayRef.current?.classList.add("is-dragging");
    },
    [slot.position.xPct, slot.position.yPct],
  );

  const moveDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (!draggingRef.current) return;
      const stage = overlayRef.current?.parentElement;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const x = clientX - dragOffsetRef.current.x - rect.left;
      const y = clientY - dragOffsetRef.current.y - rect.top;
      const xPct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const yPct = Math.max(0, Math.min(100, (y / rect.height) * 100));
      onPositionChange({ xPct, yPct });
    },
    [onPositionChange],
  );

  const endDrag = useCallback(() => {
    draggingRef.current = false;
    overlayRef.current?.classList.remove("is-dragging");
  }, []);

  useEffect(() => {
    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      const cx = "touches" in ev ? ev.touches[0]!.clientX : ev.clientX;
      const cy = "touches" in ev ? ev.touches[0]!.clientY : ev.clientY;
      moveDrag(cx, cy);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchend", endDrag);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("touchend", endDrag);
    };
  }, [moveDrag, endDrag]);

  return (
    <div
      ref={overlayRef}
      className="dss-overlay"
      style={{
        left: `${slot.position.xPct}%`,
        top: `${slot.position.yPct}%`,
        width: `${widthPx}px`,
        height: `${heightPx}px`,
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        beginDrag(e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (!t) return;
        beginDrag(t.clientX, t.clientY);
      }}
    >
      {label ? <span className="dss-overlay-label">{label}</span> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shapeAssetPath(slot.shape)} alt="" draggable={false} />
    </div>
  );
}

export type OverlayStageProps = {
  handImageUrl: string | null;
  ringSize: number;
  overlays: Array<{
    id: string;
    slot: DiamondSlotState;
    label?: string;
    onPositionChange: (position: OverlayPosition) => void;
  }>;
};

export function OverlayStage({
  handImageUrl,
  ringSize,
  overlays,
}: OverlayStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageWidthPx, setStageWidthPx] = useState(0);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setStageWidthPx(w);
    });
    ro.observe(el);
    setStageWidthPx(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [handImageUrl]);

  return (
    <>
      <div className="dss-stage-canvas">
        <div
          ref={stageRef}
          className={`dss-viewer${handImageUrl ? "" : " is-empty"}`}
          aria-label={handImageUrl ? "Hand photo with diamond overlay" : "Preview stage"}
        >
          {handImageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={handImageUrl}
                alt="Your hand"
                className="dss-hand-img"
                draggable={false}
              />
              {stageWidthPx > 0
                ? overlays.map((entry) => (
                    <OverlayLayer
                      key={entry.id}
                      slot={entry.slot}
                      ringSize={ringSize}
                      stageWidthPx={stageWidthPx}
                      label={entry.label}
                      onPositionChange={entry.onPositionChange}
                    />
                  ))
                : null}
            </>
          ) : (
            <div className="dss-stage-empty" role="status">
              <p className="dss-stage-empty-kicker">Hand preview</p>
              <p className="dss-stage-empty-title">Add your hand photo</p>
              <p className="dss-stage-empty-copy">
                Upload from the left panel or capture with your phone. Diamonds
                appear here at calibrated scale once a photo is ready.
              </p>
              <ol className="dss-stage-empty-steps">
                <li>Add a clear photo of your hand</li>
                <li>Choose shape and carat</li>
                <li>Drag diamonds into position</li>
              </ol>
            </div>
          )}
        </div>
      </div>
      <p className="dss-stage-hint">
        {handImageUrl
          ? "Drag each diamond overlay to position it on your finger. Carat and ring size update scale automatically."
          : "Confirm your ring size for scale reference. Upload a photo or scan the QR code."}
      </p>
    </>
  );
}
