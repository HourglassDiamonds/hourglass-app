"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createInitialCardCalibration,
  defaultCardEndpoints,
  defaultFingerEndpoints,
  fingerMidpoint,
  migrateLegacyCalibration,
} from "@/lib/shape-studio/card-calibration";
import { SHAPE_LABELS } from "@/lib/shape-studio/constants";
import { formatDimensionReadout } from "@/lib/shape-studio/dimensions";
import { formatCaratLabel } from "@/lib/shape-studio/overlay-scale";
import type { StoneOrientation } from "@/lib/shape-studio/orientation";
import type {
  CardCalibrationState,
  ContentPoint,
  DiamondSlotState,
  OverlayPosition,
  PhotoScaleSource,
} from "@/lib/shape-studio/types";
import { normalizeGuidedStep } from "@/lib/shape-studio/types";
import { usePhoneCaptureSession } from "@/lib/shape-studio/use-phone-capture-session";
import { CaratControl } from "./components/calibration-controls";
import DiamondStudioToolHeader from "../diamond-studio/components/DiamondStudioToolHeader";
import {
  HandPhotoPanel,
  type HandPhotoPanelHandle,
} from "./components/hand-photo-panel";
import { OverlayStage } from "./components/overlay-stage";
import ShapeComparisonEditorial from "./components/ShapeComparisonEditorial";
import { ShapeSelector } from "./components/shape-selector";
import { ShapeStudioStyles } from "./components/shape-studio-styles";

/** Centered start — capture orientation is not enforced. */
const DEFAULT_POSITION: OverlayPosition = { xPct: 50, yPct: 46 };

function createDefaultSlot(
  shape: DiamondSlotState["shape"] = "round",
  carat = 2.0,
  position: OverlayPosition = DEFAULT_POSITION,
): DiamondSlotState {
  return { shape, carat, position };
}

function clearContentPositions(
  slot: DiamondSlotState,
  position: OverlayPosition,
): DiamondSlotState {
  return { shape: slot.shape, carat: slot.carat, position };
}

const TRUST_CALIBRATED =
  "Card-calibrated from your photograph. Final ring sizing should be confirmed by a jeweler.";

function calibratedPreviewSentence(
  shape: DiamondSlotState["shape"],
  carat: number,
): string {
  const shapeLabel = SHAPE_LABELS[shape].toLowerCase();
  const caratLabel = formatCaratLabel(carat);
  const dims = formatDimensionReadout(shape, carat);
  if (shape === "round") {
    return `A ${caratLabel}-carat ${shapeLabel} diamond, shown at approximately ${dims.widthMm.toFixed(1)} mm on your hand.`;
  }
  return `A ${caratLabel}-carat ${shapeLabel} diamond, shown at approximately ${dims.widthMm.toFixed(1)} × ${dims.lengthMm.toFixed(1)} mm on your hand.`;
}

export function ShapeStudioView() {
  const handPhotoRef = useRef<HandPhotoPanelHandle>(null);
  const [handImageUrl, setHandImageUrl] = useState<string | null>(null);
  const [photoScaleSource, setPhotoScaleSource] =
    useState<PhotoScaleSource | null>(null);
  /**
   * Public Scaled Preview is always single-mode.
   * Compare slot state remains dormant in the codebase but is never exposed.
   */
  const mode = "single" as const;
  const [cardCalibration, setCardCalibration] =
    useState<CardCalibrationState | null>(null);
  /** Retained across shape switches; applied only to orientable shapes. */
  const [stoneOrientation, setStoneOrientation] =
    useState<StoneOrientation>("ns");

  const [singleSlot, setSingleSlot] = useState<DiamondSlotState>(() =>
    createDefaultSlot(),
  );

  const calibrated =
    photoScaleSource === "card-reference" &&
    cardCalibration?.step === "calibrated-preview";
  const awaitingCardCalibration =
    photoScaleSource === "card-reference" && !calibrated;

  const guidedStep = cardCalibration
    ? normalizeGuidedStep(cardCalibration.step)
    : null;

  const setCalibration = useCallback((next: CardCalibrationState | null) => {
    if (!next) {
      setCardCalibration(null);
      return;
    }
    setCardCalibration(migrateLegacyCalibration(next));
  }, []);

  const setActiveShape = useCallback((shape: DiamondSlotState["shape"]) => {
    setSingleSlot((prev) => ({ ...prev, shape }));
  }, []);

  const setActiveCarat = useCallback((carat: number) => {
    setSingleSlot((prev) => ({ ...prev, carat }));
  }, []);

  const resetSlotsForNewPhoto = useCallback(() => {
    setSingleSlot((prev) => clearContentPositions(prev, DEFAULT_POSITION));
  }, []);

  const beginCardCalibration = useCallback(() => {
    const { cardA, cardB } = defaultCardEndpoints();
    setCardCalibration({
      ...createInitialCardCalibration(),
      step: "mark-card",
      cardA,
      cardB,
    });
  }, []);

  const handleImageSelected = useCallback(
    (url: string, _source: PhotoScaleSource) => {
      /** Public journey always enters card-reference Scaled Preview. */
      void _source;
      setPhotoScaleSource("card-reference");
      resetSlotsForNewPhoto();
      const { cardA, cardB } = defaultCardEndpoints();
      setCardCalibration({
        ...createInitialCardCalibration(),
        step: "mark-card",
        cardA,
        cardB,
      });
      setHandImageUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return url;
      });
    },
    [resetSlotsForNewPhoto],
  );

  const phoneCapture = usePhoneCaptureSession(
    useCallback(
      (url: string) => {
        handleImageSelected(url, "card-reference");
      },
      [handleImageSelected],
    ),
  );

  const handleStartOver = useCallback(() => {
    phoneCapture.cancel();
    setHandImageUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setPhotoScaleSource(null);
    setCardCalibration(null);
    setSingleSlot((prev) => clearContentPositions(prev, DEFAULT_POSITION));
  }, [phoneCapture]);

  useEffect(() => {
    return () => {
      if (handImageUrl?.startsWith("blob:")) URL.revokeObjectURL(handImageUrl);
    };
  }, [handImageUrl]);

  const applySeatPositions = useCallback(
    (left: ContentPoint, right: ContentPoint) => {
      const mid = fingerMidpoint(left, right);
      setSingleSlot((prev) => ({
        ...prev,
        contentPosition: mid,
        position: DEFAULT_POSITION,
      }));
    },
    [],
  );

  const handleGuidedContinue = useCallback(() => {
    if (!cardCalibration) return;
    const prev = migrateLegacyCalibration(cardCalibration);
    const step = normalizeGuidedStep(prev.step);

    if (step === "mark-card") {
      const { fingerL, fingerR } = defaultFingerEndpoints();
      setCalibration({
        ...prev,
        step: "mark-seat",
        fingerL: prev.fingerL ?? fingerL,
        fingerR: prev.fingerR ?? fingerR,
        framing: null,
        cardStillInFrame: undefined,
      });
      return;
    }

    if (step === "mark-seat" && prev.fingerL && prev.fingerR) {
      applySeatPositions(prev.fingerL, prev.fingerR);
      setCalibration({
        ...prev,
        step: "frame",
        framing: null,
        cardStillInFrame: undefined,
      });
      return;
    }

    if (step === "frame") {
      setCalibration({ ...prev, step: "calibrated-preview" });
    }
  }, [cardCalibration, applySeatPositions, setCalibration]);

  const handleGuidedAdjust = useCallback(() => {
    setCardCalibration((prev) => {
      if (!prev) return prev;
      const migrated = migrateLegacyCalibration(prev);
      const step = normalizeGuidedStep(migrated.step);
      if (step === "mark-seat") {
        return migrateLegacyCalibration({
          ...migrated,
          step: "mark-card",
          framing: null,
          cardStillInFrame: undefined,
        });
      }
      if (step === "frame" || step === "calibrated-preview") {
        return migrateLegacyCalibration({
          ...migrated,
          step: "mark-seat",
          framing: null,
          cardStillInFrame: undefined,
        });
      }
      return migrated;
    });
  }, []);

  const handleGuidedReset = useCallback(() => {
    if (photoScaleSource !== "card-reference") return;
    resetSlotsForNewPhoto();
    beginCardCalibration();
  }, [photoScaleSource, resetSlotsForNewPhoto, beginCardCalibration]);

  const handleReframe = useCallback(() => {
    setCardCalibration((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        step: "frame",
        framing: prev.framing,
        cardStillInFrame: undefined,
      };
    });
  }, []);

  const handleFramingChange = useCallback(
    (
      framing: NonNullable<CardCalibrationState["framing"]>,
      cardStillInFrame?: boolean,
    ) => {
      setCardCalibration((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          framing,
          ...(cardStillInFrame !== undefined ? { cardStillInFrame } : {}),
        };
      });
    },
    [],
  );

  const overlayEntries = useMemo(() => {
    if (awaitingCardCalibration) return [];
    return [
      {
        id: "single",
        slot: singleSlot,
        onPositionChange: (position: OverlayPosition) =>
          setSingleSlot((prev) => ({ ...prev, position })),
        onContentPositionChange: (contentPosition: ContentPoint) =>
          setSingleSlot((prev) => ({ ...prev, contentPosition })),
      },
    ];
  }, [awaitingCardCalibration, singleSlot]);

  const liveSentence = !handImageUrl
    ? null
    : awaitingCardCalibration
      ? guidedStep === "frame"
        ? "Position your hand within the frame. Keep the card out of view."
        : guidedStep === "mark-seat"
          ? "Place the guide where the ring will sit."
          : "Align the precision lines with the two ends of the card’s long edge."
      : calibratedPreviewSentence(singleSlot.shape, singleSlot.carat);
  const trustCopy = calibrated ? TRUST_CALIBRATED : null;

  const showCarat =
    Boolean(handImageUrl) && (calibrated || awaitingCardCalibration);
  const showRail = Boolean(handImageUrl);

  return (
    <div
      className="dss-shell h-full min-h-full w-full"
      data-theme="light"
      data-shape-studio-instrument
      data-photo-scale-source={photoScaleSource ?? undefined}
      data-guided-step={guidedStep ?? undefined}
      data-studio-mode="single"
      data-entry-state={showRail ? "photo" : "capture"}
      data-stone-orientation={stoneOrientation}
    >
      <ShapeStudioStyles />
      <div className="dss-app">
        <div className={`dss-main${showRail ? "" : " dss-main--entry"}`}>
          {showRail ? (
            <aside
              className="dss-control-rail"
              aria-label="Scaled Preview controls"
            >
              <HandPhotoPanel
                ref={handPhotoRef}
                onStartOver={handleStartOver}
                onImageSelected={handleImageSelected}
              />

              {showCarat ? (
                <CaratControl
                  carat={singleSlot.carat}
                  shape={singleSlot.shape}
                  onChange={setActiveCarat}
                  orientation={stoneOrientation}
                  onOrientationChange={setStoneOrientation}
                />
              ) : null}
            </aside>
          ) : null}

          <div className="dss-stage-stack">
            <div className="dss-stage-preview" aria-label="Hand photo preview">
              <DiamondStudioToolHeader
                title="Scaled Preview"
                className="dss-tool-header"
              />
              {liveSentence ? (
                <p className="dss-sentence">{liveSentence}</p>
              ) : null}
              {trustCopy ? <p className="dss-trust-note">{trustCopy}</p> : null}
              <OverlayStage
                handImageUrl={handImageUrl}
                photoScaleSource={photoScaleSource}
                studioMode={mode}
                cardCalibration={
                  photoScaleSource === "card-reference" ? cardCalibration : null
                }
                onCardCalibrationChange={setCalibration}
                onGuidedContinue={handleGuidedContinue}
                onGuidedAdjust={handleGuidedAdjust}
                onGuidedReset={handleGuidedReset}
                onReframe={handleReframe}
                onFramingChange={handleFramingChange}
                stoneOrientation={stoneOrientation}
                overlays={overlayEntries}
                phoneCapture={showRail ? null : phoneCapture}
              />
            </div>
            {handImageUrl ? (
              <ShapeSelector
                selected={singleSlot.shape}
                onSelect={setActiveShape}
              />
            ) : null}
          </div>
        </div>
      </div>
      <ShapeComparisonEditorial />
    </div>
  );
}
