"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { shapeAssetPath } from "@/lib/shape-studio/constants";
import { overlaySizePx } from "@/lib/shape-studio/overlay-scale";
import type {
  DiamondSlotState,
  OverlayPosition,
  PhotoScaleSource,
  StudioMode,
} from "@/lib/shape-studio/types";

type OverlayLayerProps = {
  slot: DiamondSlotState;
  ringSize: number;
  referenceWidthPx: number;
  scaleSource: PhotoScaleSource | null;
  label?: string;
  onPositionChange: (position: OverlayPosition) => void;
};

function OverlayLayer({
  slot,
  ringSize,
  referenceWidthPx,
  scaleSource,
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
    referenceWidthPx,
    scaleSource,
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
        e.stopPropagation();
        beginDrag(e.clientX, e.clientY);
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
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

/**
 * Displayed content width under object-fit: contain.
 * scale = min(boxW/natW, boxH/natH); contentWidth = natW * scale.
 */
export function containedImageWidth(
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number,
  boxHeight: number,
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return 0;
  }
  const scale = Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight);
  return naturalWidth * scale;
}

function containedImageRect(
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number,
  boxHeight: number,
): { left: number; top: number; width: number; height: number } | null {
  if (naturalWidth <= 0 || naturalHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return null;
  }
  const scale = Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  return {
    left: (boxWidth - width) / 2,
    top: (boxHeight - height) / 2,
    width,
    height,
  };
}

function stageHint(
  hasImage: boolean,
  studioMode: StudioMode,
  awaitingCalibration: boolean,
): string {
  if (!hasImage) {
    return "Upload a photo or scan the QR code to begin your hand preview.";
  }
  if (awaitingCalibration) {
    return "Guided card and finger measurement is required before the scaled diamond preview is created.";
  }
  if (studioMode === "single") {
    return "Click or tap the base of your ring finger to place the diamond, then drag to refine.";
  }
  return "Drag each diamond overlay to position it on your finger.";
}

export type OverlayStageProps = {
  handImageUrl: string | null;
  ringSize: number;
  photoScaleSource?: PhotoScaleSource | null;
  studioMode?: StudioMode;
  overlays: Array<{
    id: string;
    slot: DiamondSlotState;
    label?: string;
    onPositionChange: (position: OverlayPosition) => void;
  }>;
  onUploadClick?: () => void;
  onPhoneCaptureClick?: () => void;
};

export function OverlayStage({
  handImageUrl,
  ringSize,
  photoScaleSource = null,
  studioMode = "single",
  overlays,
  onUploadClick,
  onPhoneCaptureClick,
}: OverlayStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const handImgRef = useRef<HTMLImageElement>(null);
  const [measure, setMeasure] = useState<{
    url: string;
    widthPx: number;
  } | null>(null);

  const measureReferenceWidth = useCallback(() => {
    const stage = stageRef.current;
    const img = handImgRef.current;
    if (!stage || !img || !handImageUrl) return;
    if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
    const box = stage.getBoundingClientRect();
    const widthPx = containedImageWidth(
      img.naturalWidth,
      img.naturalHeight,
      box.width,
      box.height,
    );
    if (widthPx <= 0) return;
    setMeasure({ url: handImageUrl, widthPx });
  }, [handImageUrl]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !handImageUrl) return;
    const ro = new ResizeObserver(() => {
      measureReferenceWidth();
    });
    ro.observe(el);
    if (handImgRef.current?.complete) {
      queueMicrotask(() => measureReferenceWidth());
    }
    return () => ro.disconnect();
  }, [handImageUrl, measureReferenceWidth]);

  const referenceWidthPx =
    measure?.url === handImageUrl ? measure.widthPx : 0;
  const awaitingCalibration = photoScaleSource === "card-reference";
  const scaledPreviewActive = !awaitingCalibration;
  const showOverlays =
    scaledPreviewActive && referenceWidthPx > 0 && overlays.length > 0;
  const canPlace =
    scaledPreviewActive && studioMode === "single" && Boolean(handImageUrl);

  const placeSingleOverlay = useCallback(
    (clientX: number, clientY: number) => {
      if (!canPlace) return;
      const stage = stageRef.current;
      const img = handImgRef.current;
      const single = overlays[0];
      if (!stage || !img || !single || img.naturalWidth <= 0) return;

      const box = stage.getBoundingClientRect();
      const content = containedImageRect(
        img.naturalWidth,
        img.naturalHeight,
        box.width,
        box.height,
      );
      if (!content) return;

      const x = clientX - box.left;
      const y = clientY - box.top;
      if (
        x < content.left ||
        x > content.left + content.width ||
        y < content.top ||
        y > content.top + content.height
      ) {
        return;
      }

      const xPct = Math.max(0, Math.min(100, (x / box.width) * 100));
      const yPct = Math.max(0, Math.min(100, (y / box.height) * 100));
      single.onPositionChange({ xPct, yPct });
    },
    [canPlace, overlays],
  );

  return (
    <>
      <div className="dss-stage-canvas">
        <div
          ref={stageRef}
          className={`dss-viewer${handImageUrl ? "" : " is-empty"}${
            canPlace ? " is-placeable" : ""
          }${awaitingCalibration && handImageUrl ? " is-awaiting-calibration" : ""}`}
          aria-label={
            handImageUrl
              ? awaitingCalibration
                ? "Hand photo awaiting guided measurement"
                : "Hand photo with diamond overlay"
              : "Preview stage"
          }
          onClick={(e) => {
            if (!canPlace) return;
            placeSingleOverlay(e.clientX, e.clientY);
          }}
        >
          {handImageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={handImgRef}
                src={handImageUrl}
                alt="Your hand"
                className="dss-hand-img"
                draggable={false}
                onLoad={measureReferenceWidth}
              />
              {showOverlays
                ? overlays.map((entry) => (
                    <OverlayLayer
                      key={entry.id}
                      slot={entry.slot}
                      ringSize={ringSize}
                      referenceWidthPx={referenceWidthPx}
                      scaleSource={photoScaleSource}
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
                Begin from the Hand Photo panel on the left, or use a shortcut
                below. Diamonds appear here as a visual preview once a photo is
                ready.
              </p>
              {onUploadClick || onPhoneCaptureClick ? (
                <div className="dss-stage-empty-actions">
                  {onUploadClick ? (
                    <button
                      type="button"
                      className="dss-stage-empty-btn"
                      onClick={onUploadClick}
                    >
                      Upload from this device
                    </button>
                  ) : null}
                  {onPhoneCaptureClick ? (
                    <button
                      type="button"
                      className="dss-stage-empty-btn dss-stage-empty-btn--quiet"
                      onClick={onPhoneCaptureClick}
                    >
                      Capture with phone
                    </button>
                  ) : null}
                </div>
              ) : null}
              <ol className="dss-stage-empty-steps">
                <li>Add a clear photo of your hand</li>
                <li>Choose shape and carat</li>
                <li>Place and drag the diamond on your finger</li>
              </ol>
            </div>
          )}
        </div>
      </div>
      <p className="dss-stage-hint">
        {stageHint(Boolean(handImageUrl), studioMode, awaitingCalibration)}
      </p>
    </>
  );
}
