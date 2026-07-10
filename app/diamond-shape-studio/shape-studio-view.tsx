"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createInitialCardCalibration,
  defaultCardEndpoints,
  defaultFingerEndpoints,
  fingerMidpoint,
} from "@/lib/shape-studio/card-calibration";
import { SHAPE_LABELS } from "@/lib/shape-studio/constants";
import { formatCaratLabel } from "@/lib/shape-studio/overlay-scale";
import type {
  CardCalibrationState,
  CompareSlotId,
  ContentPoint,
  DiamondSlotState,
  OverlayPosition,
  PhotoScaleSource,
  StudioMode,
} from "@/lib/shape-studio/types";
import { CaratControl, RingSizeControl } from "./components/calibration-controls";
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
/** Compare offsets keep A/B readable; not a ring-finger assumption. */
const COMPARE_A_POSITION: OverlayPosition = { xPct: 42, yPct: 46 };
const COMPARE_B_POSITION: OverlayPosition = { xPct: 58, yPct: 46 };

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

/** One source-specific trust line near the viewer. */
function trustLine(
  source: PhotoScaleSource | null,
  calibrated: boolean,
): string | null {
  if (!source) return null;
  if (source === "card-reference") {
    if (calibrated) {
      return "Scale comes from the card edge you marked. Final ring size should still be confirmed by a jeweler.";
    }
    return "Use a standard-size card to scale the diamond preview to your photo. Final ring size should still be confirmed by a jeweler.";
  }
  if (source === "known-size") {
    return "Your selected ring size helps guide this visual preview. Final sizing should be professionally confirmed.";
  }
  return "This is a visual preview, not a final sizing measurement.";
}

export function ShapeStudioView() {
  const handPhotoRef = useRef<HandPhotoPanelHandle>(null);
  const [handImageUrl, setHandImageUrl] = useState<string | null>(null);
  const [photoScaleSource, setPhotoScaleSource] =
    useState<PhotoScaleSource | null>(null);
  const [ringSize, setRingSize] = useState(6.0);
  const [mode, setMode] = useState<StudioMode>("single");
  const [activeCompareSlot, setActiveCompareSlot] =
    useState<CompareSlotId>("a");
  const [cardCalibration, setCardCalibration] =
    useState<CardCalibrationState | null>(null);

  const [singleSlot, setSingleSlot] = useState<DiamondSlotState>(() =>
    createDefaultSlot(),
  );
  const [compareA, setCompareA] = useState<DiamondSlotState>(() =>
    createDefaultSlot("round", 2.0, COMPARE_A_POSITION),
  );
  const [compareB, setCompareB] = useState<DiamondSlotState>(() =>
    createDefaultSlot("oval", 2.0, COMPARE_B_POSITION),
  );

  const calibrated =
    photoScaleSource === "card-reference" &&
    cardCalibration?.step === "calibrated-preview";
  const awaitingCardCalibration =
    photoScaleSource === "card-reference" && !calibrated;

  const activeSlot =
    mode === "single"
      ? singleSlot
      : activeCompareSlot === "a"
        ? compareA
        : compareB;

  const setActiveShape = useCallback(
    (shape: DiamondSlotState["shape"]) => {
      if (mode === "single") {
        setSingleSlot((prev) => ({ ...prev, shape }));
      } else if (activeCompareSlot === "a") {
        setCompareA((prev) => ({ ...prev, shape }));
      } else {
        setCompareB((prev) => ({ ...prev, shape }));
      }
    },
    [mode, activeCompareSlot],
  );

  const setActiveCarat = useCallback(
    (carat: number) => {
      if (mode === "single") {
        setSingleSlot((prev) => ({ ...prev, carat }));
      } else if (activeCompareSlot === "a") {
        setCompareA((prev) => ({ ...prev, carat }));
      } else {
        setCompareB((prev) => ({ ...prev, carat }));
      }
    },
    [mode, activeCompareSlot],
  );

  const resetSlotsForNewPhoto = useCallback(() => {
    setSingleSlot((prev) => clearContentPositions(prev, DEFAULT_POSITION));
    setCompareA((prev) => clearContentPositions(prev, COMPARE_A_POSITION));
    setCompareB((prev) => clearContentPositions(prev, COMPARE_B_POSITION));
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
    (url: string, source: PhotoScaleSource) => {
      setPhotoScaleSource(source);
      resetSlotsForNewPhoto();
      if (source === "card-reference") {
        const { cardA, cardB } = defaultCardEndpoints();
        setCardCalibration({
          ...createInitialCardCalibration(),
          step: "mark-card",
          cardA,
          cardB,
        });
      } else {
        setCardCalibration(null);
      }
      setHandImageUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return url;
      });
    },
    [resetSlotsForNewPhoto],
  );

  useEffect(() => {
    return () => {
      if (handImageUrl?.startsWith("blob:")) URL.revokeObjectURL(handImageUrl);
    };
  }, [handImageUrl]);

  const applyFingerSeatPositions = useCallback(
    (left: ContentPoint, right: ContentPoint) => {
      const mid = fingerMidpoint(left, right);
      /** Restrained A/B separation in content space around the finger seat. */
      const compareOffsetU = 0.035;
      setSingleSlot((prev) => ({
        ...prev,
        contentPosition: mid,
        position: DEFAULT_POSITION,
      }));
      setCompareA((prev) => ({
        ...prev,
        contentPosition: {
          u: Math.max(0, Math.min(1, mid.u - compareOffsetU)),
          v: mid.v,
        },
        position: COMPARE_A_POSITION,
      }));
      setCompareB((prev) => ({
        ...prev,
        contentPosition: {
          u: Math.max(0, Math.min(1, mid.u + compareOffsetU)),
          v: mid.v,
        },
        position: COMPARE_B_POSITION,
      }));
    },
    [],
  );

  const handleGuidedContinue = useCallback(() => {
    if (!cardCalibration) return;
    const prev = cardCalibration;
    if (prev.step === "mark-card" || prev.step === "photo-ready") {
      setCardCalibration({ ...prev, step: "confirm-card" });
      return;
    }
    if (prev.step === "confirm-card") {
      const { fingerL, fingerR } = defaultFingerEndpoints();
      setCardCalibration({ ...prev, step: "mark-finger", fingerL, fingerR });
      return;
    }
    if (prev.step === "mark-finger" && prev.fingerL && prev.fingerR) {
      applyFingerSeatPositions(prev.fingerL, prev.fingerR);
      setCardCalibration({
        ...prev,
        step: "frame",
        framing: null,
        cardStillInFrame: undefined,
      });
      return;
    }
    if (prev.step === "frame") {
      setCardCalibration({ ...prev, step: "calibrated-preview" });
    }
  }, [cardCalibration, applyFingerSeatPositions]);

  const handleGuidedAdjust = useCallback(() => {
    setCardCalibration((prev) => {
      if (!prev) return prev;
      if (prev.step === "confirm-card") {
        return { ...prev, step: "mark-card" };
      }
      if (prev.step === "mark-finger") {
        return { ...prev, step: "confirm-card" };
      }
      if (prev.step === "frame") {
        return {
          ...prev,
          step: "mark-finger",
          framing: null,
          cardStillInFrame: undefined,
        };
      }
      return prev;
    });
  }, []);

  const handleGuidedReset = useCallback(() => {
    if (photoScaleSource !== "card-reference") return;
    resetSlotsForNewPhoto();
    beginCardCalibration();
  }, [photoScaleSource, resetSlotsForNewPhoto, beginCardCalibration]);

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
    if (mode === "single") {
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
    }
    return [
      {
        id: "compare-a",
        slot: compareA,
        label: "A",
        onPositionChange: (position: OverlayPosition) =>
          setCompareA((prev) => ({ ...prev, position })),
        onContentPositionChange: (contentPosition: ContentPoint) =>
          setCompareA((prev) => ({ ...prev, contentPosition })),
      },
      {
        id: "compare-b",
        slot: compareB,
        label: "B",
        onPositionChange: (position: OverlayPosition) =>
          setCompareB((prev) => ({ ...prev, position })),
        onContentPositionChange: (contentPosition: ContentPoint) =>
          setCompareB((prev) => ({ ...prev, contentPosition })),
      },
    ];
  }, [awaitingCardCalibration, mode, singleSlot, compareA, compareB]);

  const shapeLabel = SHAPE_LABELS[activeSlot.shape].toLowerCase();
  const caratLabel = formatCaratLabel(activeSlot.carat);
  const liveSentence = !handImageUrl
    ? "Upload a hand photo to compare shapes and carat sizes as a visual preview."
    : awaitingCardCalibration
      ? cardCalibration?.step === "frame"
        ? "Position your hand within the frame. Keep the card out of view."
        : cardCalibration?.step === "mark-finger"
          ? "Align the precision lines with the two sides of the finger where the ring will sit."
          : cardCalibration?.step === "confirm-card"
            ? "Confirm the card scale for this photo."
            : "Align the precision lines with the two ends of the card’s long edge."
      : `A ${caratLabel}-carat ${shapeLabel} diamond, shown as a visual preview on your hand.`;
  const trustCopy = trustLine(photoScaleSource, calibrated);

  return (
    <div
      className="dss-shell h-full min-h-full w-full"
      data-theme="light"
      data-shape-studio-instrument
      data-photo-scale-source={photoScaleSource ?? undefined}
      data-guided-step={cardCalibration?.step ?? undefined}
    >
      <ShapeStudioStyles />
      <div className="dss-app">
        <div className="dss-main">
          <aside className="dss-control-rail" aria-label="Shape Studio controls">
            <HandPhotoPanel
              ref={handPhotoRef}
              onImageSelected={handleImageSelected}
            />

            <section className="dss-card" aria-label="Comparison mode">
              <div className="dss-card-head">Mode</div>
              <div className="dss-mode-row">
                <button
                  type="button"
                  className={`dss-mode-btn${mode === "single" ? " is-active" : ""}`}
                  onClick={() => setMode("single")}
                >
                  Single
                </button>
                <button
                  type="button"
                  className={`dss-mode-btn${mode === "compare" ? " is-active" : ""}`}
                  onClick={() => setMode("compare")}
                >
                  Compare
                </button>
              </div>
              {mode === "compare" ? (
                <div className="dss-slot-row">
                  <button
                    type="button"
                    className={`dss-slot-btn${activeCompareSlot === "a" ? " is-active" : ""}`}
                    onClick={() => setActiveCompareSlot("a")}
                  >
                    Diamond A
                  </button>
                  <button
                    type="button"
                    className={`dss-slot-btn${activeCompareSlot === "b" ? " is-active" : ""}`}
                    onClick={() => setActiveCompareSlot("b")}
                  >
                    Diamond B
                  </button>
                </div>
              ) : null}
            </section>

            <RingSizeControl
              ringSize={ringSize}
              onChange={setRingSize}
              photoScaleSource={photoScaleSource}
              cardCalibrated={calibrated}
            />
            <CaratControl
              carat={activeSlot.carat}
              shape={activeSlot.shape}
              onChange={setActiveCarat}
            />
          </aside>

          <div className="dss-stage-stack">
            <div className="dss-stage-preview" aria-label="Hand photo preview">
              <DiamondStudioToolHeader
                title="Shape Comparison"
                subhead="Compare diamond shapes on the hand before choosing a setting."
                className="dss-tool-header"
              />
              {handImageUrl ? (
                <>
                  <p className="dss-sentence">{liveSentence}</p>
                  {trustCopy ? (
                    <p className="dss-trust-note">{trustCopy}</p>
                  ) : null}
                </>
              ) : null}
              <OverlayStage
                handImageUrl={handImageUrl}
                ringSize={ringSize}
                photoScaleSource={photoScaleSource}
                studioMode={mode}
                cardCalibration={
                  photoScaleSource === "card-reference" ? cardCalibration : null
                }
                onCardCalibrationChange={setCardCalibration}
                onGuidedContinue={handleGuidedContinue}
                onGuidedAdjust={handleGuidedAdjust}
                onGuidedReset={handleGuidedReset}
                onFramingChange={handleFramingChange}
                overlays={overlayEntries}
                onUploadClick={() => handPhotoRef.current?.openDevicePicker()}
                onPhoneCaptureClick={() =>
                  handPhotoRef.current?.revealPhonePaths()
                }
              />
            </div>
            <ShapeSelector
              selected={activeSlot.shape}
              onSelect={setActiveShape}
            />
          </div>
        </div>
      </div>
      <ShapeComparisonEditorial />
    </div>
  );
}
