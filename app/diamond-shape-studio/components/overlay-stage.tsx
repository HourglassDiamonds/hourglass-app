"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  contentPointToStagePct,
  fingerMidpoint,
  isCardEdgeValid,
  isFingerSpanValid,
  pixelsPerMmFromCard,
  stagePctToContentPoint,
  type ContentRect,
} from "@/lib/shape-studio/card-calibration";
import { CARD_LONG_EDGE_MM, shapeAssetPath } from "@/lib/shape-studio/constants";
import {
  FRAMING_DEFAULT_CROP_OF_MAX,
  FRAMING_MAX_ZOOM_FACTOR,
  clampFraming,
  cropImagePaintStyle,
  displayPixelsPerMm,
  maxFittingCropWidthU,
  panFramingByViewerDelta,
  sourcePixelsPerMmFromCard,
  sourcePointToViewerPx,
  suggestInitialCrop,
  viewerPointToSourcePoint,
  zoomFraming,
} from "@/lib/shape-studio/framing";
import { overlaySizePx } from "@/lib/shape-studio/overlay-scale";
import type {
  CardCalibrationState,
  ContentPoint,
  DiamondSlotState,
  FramingState,
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
  /** Source-calibrated framed preview mapping. */
  framing: FramingState | null;
  sourceSize: { width: number; height: number } | null;
  useFramedMapping: boolean;
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
  framing,
  sourceSize,
  useFramedMapping,
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
      useFramedMapping &&
      framing &&
      sourceSize &&
      slot.contentPosition &&
      stageWidth > 0 &&
      stageHeight > 0
    ) {
      const pt = sourcePointToViewerPx(
        slot.contentPosition,
        framing,
        sourceSize,
        stageWidth,
        stageHeight,
      );
      return {
        xPct: Math.max(0, Math.min(100, (pt.x / stageWidth) * 100)),
        yPct: Math.max(0, Math.min(100, (pt.y / stageHeight) * 100)),
      };
    }
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
    useFramedMapping,
    framing,
    sourceSize,
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

      if (
        useFramedMapping &&
        framing &&
        sourceSize &&
        onContentPositionChange
      ) {
        const next = viewerPointToSourcePoint(
          (xPct / 100) * rect.width,
          (yPct / 100) * rect.height,
          framing,
          sourceSize,
          rect.width,
          rect.height,
        );
        onContentPositionChange(next);
        return;
      }

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
    [
      onPositionChange,
      onContentPositionChange,
      useContentPosition,
      content,
      useFramedMapping,
      framing,
      sourceSize,
    ],
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
  if (guidedStep === "frame") {
    return "Drag the photo to reposition. Use − / + to zoom.";
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
  onFramingChange?: (
    framing: FramingState,
    cardStillInFrame?: boolean,
  ) => void;
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
  onFramingChange,
  overlays,
  onUploadClick,
  onPhoneCaptureClick,
}: OverlayStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const handImgRef = useRef<HTMLImageElement>(null);
  const panDraggingRef = useRef(false);
  const panLastRef = useRef({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [measure, setMeasure] = useState<{
    url: string;
    naturalWidth: number;
    naturalHeight: number;
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
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
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
  const isFramingStep = isCardReference && guidedStep === "frame";
  const awaitingGuided =
    isCardReference && Boolean(handImageUrl) && !calibrated;

  const sourceSize = useMemo(() => {
    if (!layout || layout.naturalWidth <= 0 || layout.naturalHeight <= 0) {
      return null;
    }
    return { width: layout.naturalWidth, height: layout.naturalHeight };
  }, [layout]);

  const viewerAspect =
    layout && layout.stageHeight > 0
      ? layout.stageWidth / layout.stageHeight
      : 1;

  const framing = cardCalibration?.framing ?? null;
  const useFramedRender =
    Boolean(sourceSize && framing) && (isFramingStep || calibrated);

  /** Initialize / reclamp framing when entering frame or on resize. */
  useEffect(() => {
    if (!isCardReference || !cardCalibration || !sourceSize || !layout) return;
    if (guidedStep !== "frame" && guidedStep !== "calibrated-preview") return;
    if (!cardCalibration.cardA || !cardCalibration.cardB) return;
    if (!cardCalibration.fingerL || !cardCalibration.fingerR) return;

    const seat = fingerMidpoint(
      cardCalibration.fingerL,
      cardCalibration.fingerR,
    );

    if (!cardCalibration.framing) {
      if (guidedStep !== "frame") return;
      const suggested = suggestInitialCrop(
        sourceSize,
        viewerAspect,
        cardCalibration.cardA,
        cardCalibration.cardB,
        seat,
      );
      onFramingChange?.(suggested.framing, suggested.cardStillInFrame);
      return;
    }

    const clamped = clampFraming(
      cardCalibration.framing,
      sourceSize,
      viewerAspect,
    );
    if (
      Math.abs(clamped.centerU - cardCalibration.framing.centerU) > 1e-9 ||
      Math.abs(clamped.centerV - cardCalibration.framing.centerV) > 1e-9 ||
      Math.abs(clamped.cropWidthU - cardCalibration.framing.cropWidthU) > 1e-9
    ) {
      onFramingChange?.(clamped);
    }
  }, [
    isCardReference,
    cardCalibration,
    sourceSize,
    layout,
    guidedStep,
    viewerAspect,
    onFramingChange,
  ]);

  const minCropWidthU = sourceSize
    ? (maxFittingCropWidthU(sourceSize, viewerAspect) *
        FRAMING_DEFAULT_CROP_OF_MAX) /
      FRAMING_MAX_ZOOM_FACTOR
    : undefined;

  const framedPaint =
    useFramedRender && framing && sourceSize && layout
      ? cropImagePaintStyle(
          framing,
          sourceSize,
          layout.stageWidth,
          layout.stageHeight,
        )
      : null;

  /** Marker content rect: contain letterbox, or full-source paint under crop. */
  const markerContent: ContentRect | null = framedPaint
    ? {
        left: framedPaint.left,
        top: framedPaint.top,
        width: framedPaint.width,
        height: framedPaint.height,
      }
    : content;

  const sourcePpm =
    sourceSize && cardCalibration
      ? sourcePixelsPerMmFromCard(
          cardCalibration.cardA,
          cardCalibration.cardB,
          sourceSize,
        )
      : null;

  const framedDisplayPpm =
    calibrated &&
    useFramedRender &&
    framing &&
    sourceSize &&
    layout &&
    sourcePpm != null &&
    sourcePpm > 0
      ? displayPixelsPerMm(
          sourcePpm,
          framing,
          sourceSize,
          layout.stageWidth,
        )
      : null;

  /** Legacy contain-path ppm (uncropped calibrated fallback). */
  const containPixelsPerMm =
    calibrated && !useFramedRender && content && cardCalibration
      ? pixelsPerMmFromCard(
          cardCalibration.cardA,
          cardCalibration.cardB,
          content.width,
          content.height,
        )
      : null;

  const pixelsPerMm = framedDisplayPpm ?? containPixelsPerMm;

  const showOverlays =
    (!isCardReference || calibrated) &&
    (useFramedRender
      ? Boolean(framedDisplayPpm && framedDisplayPpm > 0)
      : referenceWidthPx > 0) &&
    overlays.length > 0 &&
    (!isCardReference || (pixelsPerMm != null && pixelsPerMm > 0));

  const canPlace =
    showOverlays && studioMode === "single" && Boolean(handImageUrl);

  const showCardMarkers =
    awaitingGuided &&
    !isFramingStep &&
    markerContent &&
    layout &&
    cardCalibration &&
    (guidedStep === "mark-card" ||
      guidedStep === "confirm-card" ||
      guidedStep === "photo-ready") &&
    cardCalibration.cardA &&
    cardCalibration.cardB;

  const showFingerMarkers =
    awaitingGuided &&
    markerContent &&
    layout &&
    cardCalibration &&
    (guidedStep === "mark-finger" || guidedStep === "frame") &&
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
      const x = clientX - box.left;
      const y = clientY - box.top;

      if (
        calibrated &&
        framing &&
        sourceSize &&
        single.onContentPositionChange
      ) {
        const cp = viewerPointToSourcePoint(
          x,
          y,
          framing,
          sourceSize,
          box.width,
          box.height,
        );
        single.onContentPositionChange(cp);
        return;
      }

      const nextContent = containedImageRect(
        img.naturalWidth,
        img.naturalHeight,
        box.width,
        box.height,
      );
      if (!nextContent) return;

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
    [canPlace, overlays, calibrated, framing, sourceSize],
  );

  const beginPan = useCallback(
    (clientX: number, clientY: number) => {
      if (!isFramingStep || !framing) return;
      panDraggingRef.current = true;
      panLastRef.current = { x: clientX, y: clientY };
      setPanning(true);
    },
    [isFramingStep, framing],
  );

  const movePan = useCallback(
    (clientX: number, clientY: number) => {
      if (!panDraggingRef.current || !framing || !sourceSize || !layout) return;
      const dx = clientX - panLastRef.current.x;
      const dy = clientY - panLastRef.current.y;
      panLastRef.current = { x: clientX, y: clientY };
      const next = panFramingByViewerDelta(
        framing,
        dx,
        dy,
        sourceSize,
        layout.stageWidth,
        layout.stageHeight,
      );
      onFramingChange?.(next);
    },
    [framing, sourceSize, layout, onFramingChange],
  );

  const endPan = useCallback(() => {
    panDraggingRef.current = false;
    setPanning(false);
  }, []);

  useEffect(() => {
    if (!isFramingStep) return;
    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!panDraggingRef.current) return;
      if ("touches" in ev) {
        const t = ev.touches[0];
        if (!t) return;
        movePan(t.clientX, t.clientY);
      } else {
        movePan(ev.clientX, ev.clientY);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("mouseup", endPan);
    window.addEventListener("touchend", endPan);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", endPan);
      window.removeEventListener("touchend", endPan);
    };
  }, [isFramingStep, movePan, endPan]);

  const handleZoom = useCallback(
    (direction: "in" | "out") => {
      if (!framing || !sourceSize) return;
      onFramingChange?.(
        zoomFraming(framing, direction, sourceSize, viewerAspect, minCropWidthU),
      );
    },
    [framing, sourceSize, viewerAspect, minCropWidthU, onFramingChange],
  );

  const handleResetFraming = useCallback(() => {
    if (!sourceSize || !cardCalibration?.cardA || !cardCalibration.cardB) return;
    if (!cardCalibration.fingerL || !cardCalibration.fingerR) return;
    const seat = fingerMidpoint(
      cardCalibration.fingerL,
      cardCalibration.fingerR,
    );
    const suggested = suggestInitialCrop(
      sourceSize,
      viewerAspect,
      cardCalibration.cardA,
      cardCalibration.cardB,
      seat,
    );
    onFramingChange?.(suggested.framing, suggested.cardStillInFrame);
  }, [sourceSize, cardCalibration, viewerAspect, onFramingChange]);

  return (
    <>
      <div className="dss-stage-canvas">
        <div
          ref={stageRef}
          className={`dss-viewer${handImageUrl ? "" : " is-empty"}${
            canPlace ? " is-placeable" : ""
          }${awaitingGuided ? " is-awaiting-calibration" : ""}${
            isFramingStep ? " is-framing" : ""
          }${panning ? " is-panning" : ""}${
            useFramedRender ? " is-framed-crop" : ""
          }`}
          aria-label={
            handImageUrl
              ? isFramingStep
                ? "Frame your hand photo"
                : awaitingGuided
                  ? "Hand photo awaiting guided measurement"
                  : "Hand photo with diamond overlay"
              : "Preview stage"
          }
          onClick={(e) => {
            if (!canPlace) return;
            placeSingleOverlay(e.clientX, e.clientY);
          }}
          onMouseDown={(e) => {
            if (!isFramingStep) return;
            if ((e.target as HTMLElement).closest(".dss-cal-handle")) return;
            e.preventDefault();
            beginPan(e.clientX, e.clientY);
          }}
          onTouchStart={(e) => {
            if (!isFramingStep) return;
            if ((e.target as HTMLElement).closest(".dss-cal-handle")) return;
            const t = e.touches[0];
            if (!t) return;
            beginPan(t.clientX, t.clientY);
          }}
        >
          {handImageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={handImgRef}
                src={handImageUrl}
                alt="Your hand"
                className={`dss-hand-img${
                  framedPaint ? " dss-hand-img--framed" : ""
                }`}
                style={
                  framedPaint
                    ? {
                        width: framedPaint.width,
                        height: framedPaint.height,
                        left: framedPaint.left,
                        top: framedPaint.top,
                      }
                    : undefined
                }
                draggable={false}
                onLoad={measureLayout}
              />
              {showCardMarkers && cardCalibration.cardA && cardCalibration.cardB ? (
                <CalibrationMarkers
                  stageRef={stageRef}
                  content={markerContent!}
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
                  content={markerContent!}
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
                      useContentPosition={calibrated && !useFramedRender}
                      framing={framing}
                      sourceSize={sourceSize}
                      useFramedMapping={calibrated && useFramedRender}
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
      {isFramingStep ? (
        <div className="dss-frame-copy">
          <p className="dss-frame-heading">Frame your hand</p>
          <p className="dss-frame-support">
            Position your hand within the frame. Keep the card out of view.
          </p>
        </div>
      ) : (
        <p className="dss-stage-hint">
          {stageHint(Boolean(handImageUrl), studioMode, guidedStep)}
        </p>
      )}
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
                Continue to framing
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
          {guidedStep === "frame" ? (
            <>
              <div className="dss-frame-zoom" role="group" aria-label="Zoom">
                <button
                  type="button"
                  className="dss-guide-btn dss-guide-btn--quiet"
                  onClick={() => handleZoom("out")}
                  aria-label="Zoom out"
                >
                  −
                </button>
                <button
                  type="button"
                  className="dss-guide-btn dss-guide-btn--quiet"
                  onClick={() => handleZoom("in")}
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className="dss-guide-btn"
                disabled={!framing}
                onClick={onGuidedContinue}
              >
                Show diamond preview
              </button>
              <button
                type="button"
                className="dss-guide-btn dss-guide-btn--quiet"
                onClick={handleResetFraming}
              >
                Reset framing
              </button>
              <button
                type="button"
                className="dss-guide-btn dss-guide-btn--quiet"
                onClick={onGuidedAdjust}
              >
                Adjust ring position
              </button>
              {cardCalibration.cardStillInFrame ? (
                <p className="dss-guide-warn">
                  The card is still in frame. Reposition the photo or retake it
                  with the card farther beside your hand.
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
