import Image from "next/image";
import CustomDesignMotionLink from "./custom-design-motion-link";
import {
  CUSTOM_DESIGN_ALT,
  CUSTOM_DESIGN_MEDIA,
} from "./custom-design-media-config";

const GRID = "grid grid-cols-12 gap-x-6 lg:gap-x-8";

const stageLabel =
  "text-[10px] uppercase tracking-[0.26em] text-[#8a8177]";

const stageCaption =
  "mt-3 text-[1.02rem] leading-[1.9] text-[#4a4440] md:text-[1.04rem]";

const MEDIA_PANEL_CLASS =
  "relative aspect-square w-full overflow-hidden rounded-[22px] border border-[#ddd3c6] bg-[#f5f0e9]";

const MEDIA_WASH_CLASS =
  "pointer-events-none absolute inset-0 bg-[#f5f0e9] mix-blend-multiply";

const MEDIA_SIZES =
  "(max-width: 768px) 100vw, (max-width: 1280px) 36vw, 420px";

/**
 * Shared progression media panel.
 * Outer wrapper + wash are identical for both stages.
 * Only `objectFit` differs between CAD and finished still.
 */
function ProgressionMediaPanel({
  src,
  alt,
  objectFit,
}: {
  src: string;
  alt: string;
  objectFit: "contain" | "cover";
}) {
  return (
    <div className={MEDIA_PANEL_CLASS}>
      <Image
        src={src}
        alt={alt}
        fill
        quality={95}
        sizes={MEDIA_SIZES}
        className={
          objectFit === "contain"
            ? "object-contain object-center p-6 sm:p-7 lg:p-8"
            : "object-cover object-center p-6 sm:p-7 lg:p-8"
        }
      />
      {/* Soften white source margins into the warm mat; same wash on both panels. */}
      <div aria-hidden className={MEDIA_WASH_CLASS} />
    </div>
  );
}

export default function CustomDesignProgression() {
  return (
    <section className="border-b border-[#e4dbcf] py-[56px] md:py-[72px] lg:py-[96px]">
      <div className={`${GRID} items-start`}>
        <div className="col-span-12 md:col-span-3">
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#8a8177]">
            From Direction to Form
          </div>
          <h2
            className="mt-4 max-w-[14ch] text-[1.75rem] font-light leading-[1.12] tracking-[-0.02em] text-[#1f1d1a] md:text-[2.15rem]"
            style={{ textWrap: "balance" }}
          >
            A design becomes real through refinement.
          </h2>
          <p className="mt-5 max-w-[18rem] text-[0.98rem] leading-[1.88] text-[#5f5851] md:text-[1rem] md:leading-[1.9]">
            The technical direction is established first. From there, volume,
            structure, setting height, and balance are resolved before the
            finished piece is reviewed against the original intent.
          </p>
        </div>

        <div className="col-span-12 mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 md:col-span-9 md:mt-0 lg:gap-x-8">
          <div className="min-w-0">
            <div className={stageLabel}>01 · Dimensional Form</div>
            <div className="mt-3">
              <ProgressionMediaPanel
                src={CUSTOM_DESIGN_MEDIA.cad3d}
                alt={CUSTOM_DESIGN_ALT.cad3d}
                objectFit="contain"
              />
            </div>
            <p className={stageCaption}>
              Volume, structure, setting height, and balance reviewed before
              production.
            </p>
          </div>

          <div className="min-w-0">
            <div className={stageLabel}>02 · Finished Piece</div>
            <div className="mt-3">
              <ProgressionMediaPanel
                src={CUSTOM_DESIGN_MEDIA.finishedStill}
                alt={CUSTOM_DESIGN_ALT.finishedStill}
                objectFit="cover"
              />
            </div>
            <p className={stageCaption}>
              The completed ring, reviewed against the approved direction before
              it is presented.
            </p>
            <CustomDesignMotionLink />
          </div>
        </div>
      </div>
    </section>
  );
}
