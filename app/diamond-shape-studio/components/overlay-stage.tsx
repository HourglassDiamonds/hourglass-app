"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  contentPointToStagePct,
  isCardEdgeValid,
  isFingerSpanValid,
  pixelsPerMmFromCard,
  stagePctToContentPoint,
  type ContentRect,
} from "@/lib/shape-studio/card-calibration";
import { CARD_LONG_EDGE_MM, shapeAssetPath } from "@/lib/shape-studio/constants";
import { overlaySizePx } from "@/lib/shape-studio/overlay-scale";
import type {
  CardCalibrationState,
  ContentPoint,
  DiamondSlotState,
  GuidedCalibrationStep,
  OverlayPosition,
  PhotoScaleSource,
  StudioMode,
} from "@/lib/shape-studio/types";
import { CalibrationMarkers } from "./calibration-markers";

type OverlayLayerProps = {
  slot: DiamondSlotState;
  ringSize: number;
  referenceWidthPx: number;
  scaleSource: PhotoScaleSource | null;
  pixelsPerMm: number | null;
  content: ContentRect | null;
  stageWidth: number;
  stageHeight: number;
  useContentPosition: boolean;
  label?: string;
  onPositionChange: (position: OverlayPosition) => void;
  onContentPositionChange?: (position: ContentPoint) => void;
};

function OverlayLayer({
  slot,
  ringSize,
  referenceWidthPx,
  scaleSource,
  pixelsPerMm,
  content,
  stageWidth,
  stageHeight,
  useContentPosition,
  label,
  onPositionChange,
  onContentPositionChange,
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
    pixelsPerMm,
  );

  const paintPosition = useMemo(() => {
    if (
      useContentPosition &&
      slot.contentPosition &&
      content &&
      stageWidth > 0 &&
      stageHeight > 0
    ) {
      return contentPointToStagePct(
        slot.contentPosition,
        content,
        stageWidth,
        stageHeight,
      );
    }
    return slot.position;
  }, [
    useContentPosition,
    slot.contentPosition,
    slot.position,
    content,
    stageWidth,
    stageHeight,
  ]);

  const beginDrag = useCallback(
    (clientX: number, clientY: number) => {
      const stage = overlayRef.current?.parentElement;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const centerX = rect.left + (paintPosition.xPct / 100) * rect.width;
      const centerY = rect.top + (paintPosition.yPct / 100) * rect.height;
      draggingRef.current = true;
      dragOffsetRef.current = { x: clientX - centerX, y: clientY - centerY };
      overlayRef.current?.classList.add("is-dragging");
    },
    [paintPosition.xPct, paintPosition.yPct],
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
      const stagePos = { xPct, yPct };

      if (useContentPosition && content && onContentPositionChange) {
        const next = stagePctToContentPoint(
          stagePos,
          content,
          rect.width,
          rect.height,
        );
        if (next) {
          onContentPositionChange(next);
          return;
        }
      }
      onPositionChange(stagePos);
    },
    [onPositionChange, onContentPositionChange, useContentPosition, content],
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
        left: `${paintPosition.xPct}%`,
        top: `${paintPosition.yPct}%`,
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

export function containedImageRect(
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number,
  boxHeight: number,
): ContentRect | null {
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
  guidedStep: GuidedCalibrationStep | null,
): string {
  if (!hasImage) {
    return "Upload a photo or scan the QR code to begin your hand preview.";
  }
  if (guidedStep === "mark-card" || guidedStep === "photo-ready") {
    return "Align the precision lines with the two ends of the card’s long edge.";
  }
  if (guidedStep === "confirm-card") {
    return `Card edge set to ${CARD_LONG_EDGE_MM.toFixed(2)} mm. This establishes the scale for this photo.`;
  }
  if (guidedStep === "mark-finger") {
    return "Align the precision lines with the two sides of the finger where the ring will sit.";
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
  cardCalibration?: CardCalibrationState | null;
  onCardCalibrationChange?: (next: CardCalibrationState) => void;
  onGuidedContinue?: () => void;
  onGuidedAdjust?: () => void;
  onGuidedReset?: () => void;
  overlays: Array<{
    id: string;
    slot: DiamondSlotState;
    label?: string;
    onPositionChange: (position: OverlayPosition) => void;
    onContentPositionChange?: (position: ContentPoint) => void;
  }>;
  onUploadClick?: () => void;
  onPhoneCaptureClick?: () => void;
};

export function OverlayStage({
  handImageUrl,
  ringSize,
  photoScaleSource = null,
  studioMode = "single",
  cardCalibration = null,
  onCardCalibrationChange,
  onGuidedContinue,
  onGuidedAdjust,
  onGuidedReset,
  overlays,
  onUploadClick,
  onPhoneCaptureClick,
}: OverlayStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const handImgRef = useRef<HTMLImageElement>(null);
  const [measure, setMeasure] = useState<{
    url: string;
    widthPx: number;
    heightPx: number;
    content: ContentRect;
    stageWidth: number;
    stageHeight: number;
  } | null>(null);

  const measureLayout = useCallback(() => {
    const stage = stageRef.current;
    const img = handImgRef.current;
    if (!stage || !img || !handImageUrl) return;
    if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
    const box = stage.getBoundingClientRect();
    const content = containedImageRect(
      img.naturalWidth,
      img.naturalHeight,
      box.width,
      box.height,
    );
    if (!content || content.width <= 0) return;
    setMeasure({
      url: handImageUrl,
      widthPx: content.width,
      heightPx: content.height,
      content,
      stageWidth: box.width,
      stageHeight: box.height,
    });
  }, [handImageUrl]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !handImageUrl) return;
    const ro = new ResizeObserver(() => {
      measureLayout();
    });
    ro.observe(el);
    if (handImgRef.current?.complete) {
      queueMicrotask(() => measureLayout());
    }
    return () => ro.disconnect();
  }, [handImageUrl, measureLayout]);

  const layout = measure?.url === handImageUrl ? measure : null;
  const referenceWidthPx = layout?.widthPx ?? 0;
  const content = layout?.content ?? null;
  const guidedStep = cardCalibration?.step ?? null;
  const isCardReference = photoScaleSource === "card-reference";
  const calibrated =
    isCardReference && guidedStep === "calibrated-preview";
  const awaitingGuided =
    isCardReference && Boolean(handImageUrl) && !calibrated;

  const pixelsPerMm =
    calibrated && content && cardCalibration
      ? pixelsPerMmFromCard(
          cardCalibration.cardA,
          cardCalibration.cardB,
          content.width,
          content.height,
        )
      : null;

  const showOverlays =
    (!isCardReference || calibrated) &&
    referenceWidthPx > 0 &&
    overlays.length > 0 &&
    (!isCardReference || (pixelsPerMm != null && pixelsPerMm > 0));

  const canPlace =
    showOverlays && studioMode === "single" && Boolean(handImageUrl);

  const showCardMarkers =
    awaitingGuided &&
    content &&
    layout &&
    cardCalibration &&
    (guidedStep === "mark-card" ||
      guidedStep === "confirm-card" ||
      guidedStep === "photo-ready") &&
    cardCalibration.cardA &&
    cardCalibration.cardB;

  const showFingerMarkers =
    awaitingGuided &&
    content &&
    layout &&
    cardCalibration &&
    guidedStep === "mark-finger" &&
    cardCalibration.fingerL &&
    cardCalibration.fingerR;

  const cardEdgeOk =
    content &&
    cardCalibration?.cardA &&
    cardCalibration.cardB &&
    isCardEdgeValid(
      cardCalibration.cardA,
      cardCalibration.cardB,
      content.width,
      content.height,
    );

  const fingerSpanOk =
    content &&
    cardCalibration?.fingerL &&
    cardCalibration.fingerR &&
    isFingerSpanValid(
      cardCalibration.fingerL,
      cardCalibration.fingerR,
      content.width,
      content.height,
    );

  const placeSingleOverlay = useCallback(
    (clientX: number, clientY: number) => {
      if (!canPlace) return;
      const stage = stageRef.current;
      const img = handImgRef.current;
      const single = overlays[0];
      if (!stage || !img || !single || img.naturalWidth <= 0) return;

      const box = stage.getBoundingClientRect();
      const nextContent = containedImageRect(
        img.naturalWidth,
        img.naturalHeight,
        box.width,
        box.height,
      );
      if (!nextContent) return;

      const x = clientX - box.left;
      const y = clientY - box.top;
      if (
        x < nextContent.left ||
        x > nextContent.left + nextContent.width ||
        y < nextContent.top ||
        y > nextContent.top + nextContent.height
      ) {
        return;
      }

      const xPct = Math.max(0, Math.min(100, (x / box.width) * 100));
      const yPct = Math.max(0, Math.min(100, (y / box.height) * 100));
      const stagePos = { xPct, yPct };

      if (calibrated && single.onContentPositionChange) {
        const cp = stagePctToContentPoint(
          stagePos,
          nextContent,
          box.width,
          box.height,
        );
        if (cp) {
          single.onContentPositionChange(cp);
          return;
        }
      }
      single.onPositionChange(stagePos);
    },
    [canPlace, overlays, calibrated],
  );

  return (
    <>
      <div className="dss-stage-canvas">
        <div
          ref={stageRef}
          className={`dss-viewer${handImageUrl ? "" : " is-empty"}${
            canPlace ? " is-placeable" : ""
          }${awaitingGuided ? " is-awaiting-calibration" : ""}`}
          aria-label={
            handImageUrl
              ? awaitingGuided
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
                onLoad={measureLayout}
              />
              {showCardMarkers && cardCalibration.cardA && cardCalibration.cardB ? (
                <CalibrationMarkers
                  stageRef={stageRef}
                  content={content!}
                  stageWidth={layout!.stageWidth}
                  stageHeight={layout!.stageHeight}
                  mode="card"
                  points={{
                    a: cardCalibration.cardA,
                    b: cardCalibration.cardB,
                  }}
                  onChange={({ a, b }) => {
                    onCardCalibrationChange?.({
                      ...cardCalibration,
                      cardA: a,
                      cardB: b,
                    });
                  }}
                />
              ) : null}
              {showFingerMarkers &&
              cardCalibration.fingerL &&
              cardCalibration.fingerR ? (
                <CalibrationMarkers
                  stageRef={stageRef}
                  content={content!}
                  stageWidth={layout!.stageWidth}
                  stageHeight={layout!.stageHeight}
                  mode="finger"
                  points={{
                    a: cardCalibration.fingerL,
                    b: cardCalibration.fingerR,
                  }}
                  onChange={({ a, b }) => {
                    onCardCalibrationChange?.({
                      ...cardCalibration,
                      fingerL: a,
                      fingerR: b,
                    });
                  }}
                />
              ) : null}
              {showOverlays
                ? overlays.map((entry) => (
                    <OverlayLayer
                      key={entry.id}
                      slot={entry.slot}
                      ringSize={ringSize}
                      referenceWidthPx={referenceWidthPx}
                      scaleSource={photoScaleSource}
                      pixelsPerMm={pixelsPerMm}
                      content={content}
                      stageWidth={layout?.stageWidth ?? 0}
                      stageHeight={layout?.stageHeight ?? 0}
                      useContentPosition={calibrated}
                      label={entry.label}
                      onPositionChange={entry.onPositionChange}
                      onContentPositionChange={entry.onContentPositionChange}
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
        {stageHint(Boolean(handImageUrl), studioMode, guidedStep)}
      </p>
      {awaitingGuided && cardCalibration ? (
        <div className="dss-guide-actions" role="group" aria-label="Guided measurement">
          {guidedStep === "mark-card" || guidedStep === "photo-ready" ? (
            <>
              <button
                type="button"
                className="dss-guide-btn"
                disabled={!cardEdgeOk}
                onClick={onGuidedContinue}
              >
                Continue
              </button>
              <button
                type="button"
                className="dss-guide-btn dss-guide-btn--quiet"
                onClick={onGuidedReset}
              >
                Reset points
              </button>
              {!cardEdgeOk && content ? (
                <p className="dss-guide-warn">
                  Move the points farther apart along the card’s long edge.
                </p>
              ) : null}
            </>
          ) : null}
          {guidedStep === "confirm-card" ? (
            <>
              <button
                type="button"
                className="dss-guide-btn"
                onClick={onGuidedContinue}
              >
                Continue
              </button>
              <button
                type="button"
                className="dss-guide-btn dss-guide-btn--quiet"
                onClick={onGuidedAdjust}
              >
                Adjust marks
              </button>
            </>
          ) : null}
          {guidedStep === "mark-finger" ? (
            <>
              <p className="dss-guide-support">
                This places the preview. It does not estimate your ring size.
              </p>
              <button
                type="button"
                className="dss-guide-btn"
                disabled={!fingerSpanOk}
                onClick={onGuidedContinue}
              >
                Show diamond preview
              </button>
              <button
                type="button"
                className="dss-guide-btn dss-guide-btn--quiet"
                onClick={onGuidedAdjust}
              >
                Adjust card marks
              </button>
              {!fingerSpanOk ? (
                <p className="dss-guide-warn">
                  Place the points on opposite sides of the finger.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      {calibrated ? (
        <div className="dss-guide-actions">
          <button
            type="button"
            className="dss-guide-btn dss-guide-btn--quiet"
            onClick={onGuidedReset}
          >
            Recalibrate photo scale
          </button>
        </div>
      ) : null}
    </>
  );
}
