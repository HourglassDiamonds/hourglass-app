"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  contentPointToStagePct,
  fingerMidpoint,
  isCardEdgeValid,
  isFingerSpanValid,
  isMarkCardStep,
  isMarkSeatStep,
  pixelsPerMmFromCard,
  stagePctToContentPoint,
  type ContentRect,
} from "@/lib/shape-studio/card-calibration";
import { shapeAssetPath } from "@/lib/shape-studio/constants";
import { overlayImageLayoutStyle } from "@/lib/shape-studio/asset-bounds";
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
import { overlaySizeFromCardPpm, overlaySizePx } from "@/lib/shape-studio/overlay-scale";
import {
  effectiveOrientation,
  type StoneOrientation,
} from "@/lib/shape-studio/orientation";
import { renderStoneHeightMm, renderStoneWidthMm } from "@/lib/shape-studio/dimensions";
import {
  normalizeGuidedStep,
  type CardCalibrationState,
  type ContentPoint,
  type DiamondSlotState,
  type FramingState,
  type GuidedCalibrationStep,
  type OverlayPosition,
  type PhotoScaleSource,
  type StudioMode,
} from "@/lib/shape-studio/types";
import type { PhoneCaptureSession } from "@/lib/shape-studio/use-phone-capture-session";
import { SCALED_CAPTURE_MODE } from "@/lib/shape-studio/use-phone-capture-session";
import { CalibrationMarkers } from "./calibration-markers";
import {
  DirectMobileEntry,
  DirectMobileReview,
} from "./direct-mobile-entry";
import { QrCapturePanel } from "./qr-capture-panel";

type OverlayLayerProps = {
  slot: DiamondSlotState;
  /** Required only for non–card-calibrated (heuristic) sizing. */
  ringSize?: number;
  referenceWidthPx: number;
  scaleSource: PhotoScaleSource | null;
  pixelsPerMm: number | null;
  orientation: StoneOrientation;
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
  orientation,
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

  const renderOrientation = effectiveOrientation(slot.shape, orientation);
  const { widthPx, heightPx } =
    scaleSource === "card-reference" &&
    pixelsPerMm != null &&
    pixelsPerMm > 0
      ? overlaySizeFromCardPpm(
          slot.shape,
          slot.carat,
          pixelsPerMm,
          renderOrientation,
        )
      : overlaySizePx(
          slot.shape,
          slot.carat,
          ringSize ?? 0,
          referenceWidthPx,
          scaleSource,
          pixelsPerMm,
          renderOrientation,
        );

  /** Canonical N/S face box; E/W rotates this 90° inside the oriented outer. */
  const nsFace =
    scaleSource === "card-reference" &&
    pixelsPerMm != null &&
    pixelsPerMm > 0
      ? overlaySizeFromCardPpm(slot.shape, slot.carat, pixelsPerMm, "ns")
      : overlaySizePx(
          slot.shape,
          slot.carat,
          ringSize ?? 0,
          referenceWidthPx,
          scaleSource,
          pixelsPerMm,
          "ns",
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
      <div
        className={`dss-overlay-face${
          renderOrientation === "ew" ? " dss-overlay-face--ew" : ""
        }`}
        style={
          renderOrientation === "ew"
            ? {
                width: `${nsFace.widthPx}px`,
                height: `${nsFace.heightPx}px`,
              }
            : undefined
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shapeAssetPath(slot.shape)}
          alt=""
          draggable={false}
          style={overlayImageLayoutStyle(slot.shape)}
        />
      </div>
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
    return "Upload a hand-and-card photo, or capture with your phone, to begin Scaled Preview.";
  }
  const step = guidedStep ? normalizeGuidedStep(guidedStep) : null;
  if (step === "mark-card") {
    return "Align the precision lines with the two ends of the card’s long edge.";
  }
  if (step === "mark-seat") {
    return "Place the guide where the ring will sit.";
  }
  if (step === "frame") {
    return "Drag the photo to reposition. Use − / + to zoom.";
  }
  if (studioMode === "single") {
    return "Drag the diamond to refine its place on your finger.";
  }
  return "Drag the diamond overlay to position it on your finger.";
}

export type OverlayStageProps = {
  handImageUrl: string | null;
  /** Optional — unused on the public card-calibrated Scaled Preview path. */
  ringSize?: number;
  photoScaleSource?: PhotoScaleSource | null;
  studioMode?: StudioMode;
  cardCalibration?: CardCalibrationState | null;
  onCardCalibrationChange?: (next: CardCalibrationState) => void;
  onGuidedContinue?: () => void;
  onGuidedAdjust?: () => void;
  onGuidedReset?: () => void;
  onReframe?: () => void;
  onFramingChange?: (
    framing: FramingState,
    cardStillInFrame?: boolean,
  ) => void;
  /** Elongated-shape face orientation preference (N/S default). */
  stoneOrientation?: StoneOrientation;
  overlays: Array<{
    id: string;
    slot: DiamondSlotState;
    label?: string;
    onPositionChange: (position: OverlayPosition) => void;
    onContentPositionChange?: (position: ContentPoint) => void;
  }>;
  onUploadClick?: () => void;
  /** Single authoritative phone-capture session (centered entry only). */
  phoneCapture?: PhoneCaptureSession | null;
  /**
   * Same-device pending review URL (blob). When set, entry shows local review
   * instead of capture CTAs. Confirm via onConfirmLocalPhoto.
   */
  pendingLocalPhotoUrl?: string | null;
  onPendingLocalPhoto?: (objectUrl: string) => void;
  onConfirmLocalPhoto?: () => void;
  onRetakeLocalPhoto?: () => void;
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
  onReframe,
  onFramingChange,
  stoneOrientation = "ns",
  overlays,
  phoneCapture = null,
  pendingLocalPhotoUrl = null,
  onPendingLocalPhoto,
  onConfirmLocalPhoto,
  onRetakeLocalPhoto,
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
  const rawGuidedStep = cardCalibration?.step ?? null;
  const guidedStep = rawGuidedStep
    ? normalizeGuidedStep(rawGuidedStep)
    : null;
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

  const primarySlot = overlays[0]?.slot ?? null;
  /** QA-only: jaw span measures apparent finger width; never drives diamond scale. */
  const fingerCoverageProbe = (() => {
    if (
      !sourceSize ||
      sourcePpm == null ||
      sourcePpm <= 0 ||
      !cardCalibration?.fingerL ||
      !cardCalibration.fingerR ||
      !primarySlot
    ) {
      return null;
    }
    const fl = cardCalibration.fingerL;
    const fr = cardCalibration.fingerR;
    const jawSpanSourcePx = Math.hypot(
      (fr.u - fl.u) * sourceSize.width,
      (fr.v - fl.v) * sourceSize.height,
    );
    const apparentFingerWidthMm = jawSpanSourcePx / sourcePpm;
    const visibleDiamondWidthMm = renderStoneWidthMm(
      primarySlot.shape,
      primarySlot.carat,
    );
    const diamondToFingerCoveragePct =
      apparentFingerWidthMm > 0
        ? (visibleDiamondWidthMm / apparentFingerWidthMm) * 100
        : null;
    return {
      jawSpanSourcePx: String(jawSpanSourcePx),
      apparentFingerWidthMm: String(apparentFingerWidthMm),
      visibleDiamondWidthMm: String(visibleDiamondWidthMm),
      diamondToFingerCoveragePct:
        diamondToFingerCoveragePct != null
          ? String(diamondToFingerCoveragePct)
          : undefined,
    };
  })();
  const scaleProbe =
    calibrated &&
    sourceSize &&
    framing &&
    sourcePpm != null &&
    pixelsPerMm != null &&
    primarySlot
      ? {
          sourceW: String(sourceSize.width),
          sourceH: String(sourceSize.height),
          sourcePpm: String(sourcePpm),
          displayPpm: String(pixelsPerMm),
          cropWidthU: String(framing.cropWidthU),
          centerU: String(framing.centerU),
          centerV: String(framing.centerV),
          stoneWMm: String(renderStoneWidthMm(primarySlot.shape, primarySlot.carat)),
          stoneHMm: String(
            renderStoneHeightMm(primarySlot.shape, primarySlot.carat),
          ),
          ...fingerCoverageProbe,
        }
      : null;

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
    rawGuidedStep != null &&
    isMarkCardStep(rawGuidedStep) &&
    cardCalibration.cardA &&
    cardCalibration.cardB;

  const showFingerMarkers =
    awaitingGuided &&
    markerContent &&
    layout &&
    cardCalibration &&
    rawGuidedStep != null &&
    (isMarkSeatStep(rawGuidedStep) || guidedStep === "frame") &&
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

  /** Pre-photo entry / QR — separate from the calibrated viewer chrome. */
  if (!handImageUrl) {
    const showQr =
      Boolean(phoneCapture) &&
      (phoneCapture!.phase === "creating" ||
        phoneCapture!.phase === "active" ||
        Boolean(phoneCapture!.error) ||
        phoneCapture!.expired);
    const showLocalReview = Boolean(pendingLocalPhotoUrl) && !showQr;

    return (
      <div className="dss-entry-surface" data-dss-entry-panel>
        <div
          className={`dss-entry-card${showQr ? " dss-entry-card--qr" : ""}${
            showLocalReview ? " dss-entry-card--review" : ""
          }`}
          role="status"
          aria-label={
            showQr
              ? "Phone capture session"
              : showLocalReview
                ? "Selected photograph review"
                : "Scaled Preview entry"
          }
        >
          {showQr ? (
            phoneCapture!.phase === "creating" ? (
              <p className="dss-qr-loading">Preparing QR capture session…</p>
            ) : phoneCapture!.captureUrl && phoneCapture!.expiresAt ? (
              <QrCapturePanel
                captureUrl={phoneCapture!.captureUrl}
                captureMode={SCALED_CAPTURE_MODE}
                expiresAt={phoneCapture!.expiresAt}
                waiting={phoneCapture!.waiting}
                expired={phoneCapture!.expired}
                error={phoneCapture!.error}
                onCancel={phoneCapture!.cancel}
                variant="stage"
              />
            ) : (
              <div className="dss-qr-panel dss-qr-panel--stage">
                <p className="dss-qr-message dss-qr-message--warn">
                  {phoneCapture!.error ?? "Unable to start phone capture."}
                </p>
                <button
                  type="button"
                  className="dss-qr-cancel"
                  onClick={phoneCapture!.cancel}
                >
                  Cancel phone capture
                </button>
              </div>
            )
          ) : showLocalReview && pendingLocalPhotoUrl ? (
            <DirectMobileReview
              imageUrl={pendingLocalPhotoUrl}
              onUseThisPhoto={() => onConfirmLocalPhoto?.()}
              onRetake={() => onRetakeLocalPhoto?.()}
            />
          ) : (
            <>
              {/* Desktop / wide: QR relay remains the primary entry. */}
              <div className="dss-entry-desktop" data-dss-entry-desktop>
                <p className="dss-stage-empty-kicker">Hand preview</p>
                <p className="dss-stage-empty-title">
                  Add your hand-and-card photo
                </p>
                <p className="dss-stage-empty-copy">
                  Use your phone to photograph your hand with a standard-size card
                  beside it. We’ll use the card to establish visual scale, then
                  frame it out of the final preview.
                </p>
                {phoneCapture ? (
                  <div className="dss-stage-empty-actions">
                    <button
                      type="button"
                      className="dss-stage-empty-btn"
                      onClick={phoneCapture.start}
                    >
                      Capture with phone
                    </button>
                  </div>
                ) : null}
                <p className="dss-stage-empty-privacy">
                  Use a blank gift card, hotel key, or standard-size loyalty card.
                  Avoid cards showing personal or financial information.
                </p>
              </div>
              {/* Narrow phone: same-device camera capture — no QR primary. */}
              {onPendingLocalPhoto ? (
                <DirectMobileEntry
                  onPhotoSelected={onPendingLocalPhoto}
                  onUseAnotherDevice={
                    phoneCapture ? () => phoneCapture.start() : undefined
                  }
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="dss-stage-canvas">
        <div
          ref={stageRef}
          className={`dss-viewer${
            canPlace ? " is-placeable" : ""
          }${awaitingGuided ? " is-awaiting-calibration" : ""}${
            isFramingStep ? " is-framing" : ""
          }${panning ? " is-panning" : ""}${
            useFramedRender ? " is-framed-crop" : ""
          }`}
          data-qa-source-w={scaleProbe?.sourceW}
          data-qa-source-h={scaleProbe?.sourceH}
          data-qa-source-ppm={scaleProbe?.sourcePpm}
          data-qa-display-ppm={scaleProbe?.displayPpm}
          data-qa-crop-width-u={scaleProbe?.cropWidthU}
          data-qa-center-u={scaleProbe?.centerU}
          data-qa-center-v={scaleProbe?.centerV}
          data-qa-stone-w-mm={scaleProbe?.stoneWMm}
          data-qa-stone-h-mm={scaleProbe?.stoneHMm}
          data-qa-jaw-span-source-px={scaleProbe?.jawSpanSourcePx}
          data-qa-apparent-finger-width-mm={scaleProbe?.apparentFingerWidthMm}
          data-qa-visible-diamond-width-mm={scaleProbe?.visibleDiamondWidthMm}
          data-qa-diamond-to-finger-coverage-pct={
            scaleProbe?.diamondToFingerCoveragePct
          }
          aria-label={
            isFramingStep
              ? "Frame your hand photo"
              : awaitingGuided
                ? "Hand photo awaiting guided measurement"
                : "Hand photo with diamond overlay"
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
                    orientation={stoneOrientation}
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
        <div className="dss-guide-actions" role="group" aria-label="Scaled Preview steps">
          {guidedStep === "mark-card" ? (
            <>
              <button
                type="button"
                className="dss-guide-btn"
                disabled={!cardEdgeOk}
                onClick={onGuidedContinue}
              >
                Set photo scale
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
          {guidedStep === "mark-seat" ? (
            <>
              <p className="dss-guide-support">
                This sets the preview position. Scale comes from the card you
                marked.
              </p>
              <button
                type="button"
                className="dss-guide-btn"
                disabled={!fingerSpanOk}
                onClick={onGuidedContinue}
              >
                Frame my hand
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
            onClick={onReframe}
          >
            Reframe
          </button>
          <button
            type="button"
            className="dss-guide-btn dss-guide-btn--quiet"
            onClick={onGuidedAdjust}
          >
            Adjust ring position
          </button>
          <button
            type="button"
            className="dss-guide-btn dss-guide-btn--quiet"
            onClick={onGuidedReset}
          >
            Adjust card marks
          </button>
        </div>
      ) : null}
    </>
  );
}
