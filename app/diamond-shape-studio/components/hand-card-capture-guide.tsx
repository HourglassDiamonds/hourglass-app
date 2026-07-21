import Image from "next/image";

/** Public instructional asset used by desktop capture and mobile entry. */
export const HAND_CARD_CAPTURE_GUIDE_SRC =
  "/diamond-tech-suite/see-it-on-hgd.png";

export const HAND_CARD_CAPTURE_GUIDE_ALT =
  "Example showing a hand and card positioned for a calibrated preview";

type HandCardCaptureGuideProps = {
  /** Passed to next/image `sizes` for responsive src selection. */
  sizes?: string;
  /** Optional caption under the frame (desktop capture page). */
  showCaption?: boolean;
  /** Outer wrapper class — default matches capture-page guide. */
  className?: string;
};

/**
 * Shared hand + standard-size card instructional figure.
 * Styles live with each host surface (capture page vs shape-studio entry).
 */
export function HandCardCaptureGuide({
  sizes = "280px",
  showCaption = true,
  className = "dss-capture-guide",
}: HandCardCaptureGuideProps) {
  return (
    <div className={className}>
      <div className="dss-capture-guide-frame">
        <Image
          src={HAND_CARD_CAPTURE_GUIDE_SRC}
          alt={HAND_CARD_CAPTURE_GUIDE_ALT}
          fill
          className="object-contain"
          sizes={sizes}
          priority
        />
      </div>
      {showCaption ? (
        <p className="dss-capture-guide-caption">Hand + blank card in frame</p>
      ) : null}
    </div>
  );
}
