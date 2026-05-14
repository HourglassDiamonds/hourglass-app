"use client";

import Image from "next/image";
import Link from "next/link";

/** Fine grain for the studio portal tile (matches homepage hero treatment). */
function StudioPortalTexture() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-multiply"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 20%, rgba(0,0,0,0.16) 0.6px, transparent 0.8px), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.14) 0.6px, transparent 0.8px)",
        backgroundSize: "26px 26px, 34px 34px",
      }}
    />
  );
}

function StudioPortalCursorGlow() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 opacity-0 transition duration-300 group-hover:opacity-100"
      style={{
        background:
          "radial-gradient(560px circle at var(--x, 50%) var(--y, 50%), rgba(255,255,255,0.55), transparent 55%)",
      }}
    />
  );
}

/**
 * Homepage “Diamond Size Studio” portal — single source of truth for this block.
 * Route: /diamond-studio
 */
export default function HomeStudioPortal() {
  return (
    <div className="w-full" data-hourglass-home="diamond-size-studio">
      <Link
        href="/diamond-studio"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty(
            "--x",
            `${e.clientX - rect.left}px`,
          );
          e.currentTarget.style.setProperty(
            "--y",
            `${e.clientY - rect.top}px`,
          );
        }}
        className="group relative block w-full cursor-pointer overflow-hidden rounded-[36px] border border-[#dcd2c4]/78 bg-[#faf6f1] shadow-[0_12px_34px_rgba(49,38,29,0.038)] transition-[transform,box-shadow,border-color,background-color] duration-[300ms] ease-[cubic-bezier(0.28,0.11,0.22,1)] hover:-translate-y-[1px] hover:border-[#cbbfb0]/82 hover:bg-[#fcf9f5] hover:shadow-[0_16px_42px_rgba(49,38,29,0.052)]"
        aria-label="Enter the Diamond Size Studio"
      >
        <StudioPortalTexture />

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 72% 34%, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.14) 16%, transparent 36%),
              radial-gradient(circle at 82% 52%, rgba(255,255,255,0.12), transparent 20%),
              linear-gradient(135deg, #efe8df 0%, #f8f3ec 52%, #fcfaf7 100%)
            `,
          }}
        />

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 70% 32%, rgba(255,255,255,0.1) 0%, transparent 18%),
              radial-gradient(circle at 58% 58%, rgba(255,255,255,0.06) 0%, transparent 24%)
            `,
          }}
        />

        <StudioPortalCursorGlow />

        <div className="relative grid min-h-[400px] grid-cols-1 items-center px-8 py-9 md:min-h-[460px] md:grid-cols-[1.02fr_0.98fr] md:px-12 md:py-11">
          <div className="mx-auto max-w-[380px] text-center md:mx-0 md:max-w-[380px] md:text-left">
            <div className="text-[11px] tracking-[0.34em] text-[#8d8275]">
              THE DIAMOND SIZE STUDIO
            </div>

            <h2 className="mt-5 max-w-[24ch] font-serif text-[1.85rem] font-normal leading-[1.12] tracking-[-0.03em] text-[#27231f] md:text-[2.2rem]">
              Modern tools for choosing with clarity.
            </h2>

            <p className="mt-5 max-w-[36ch] text-[0.98rem] leading-[1.9] text-[#5d564f]">
              Explore diamond size, finger coverage, shape, and proportion
              through a more visual way to understand scale.
            </p>

            <div className="relative mt-8 inline-block pb-1 text-[11px] uppercase tracking-[0.35em] text-[#5c534a] transition-colors duration-300 ease-out group-hover:text-[#4a4138]">
              <span className="inline-flex items-center gap-[0.2em]">
                <span>Enter the Studio</span>
                <span className="relative inline-flex h-[1.2em] w-[1.2em] shrink-0 items-center justify-center">
                  <span
                    className="pointer-events-none absolute inset-[-0.45em] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,252,247,0.22)_0%,rgba(250,244,236,0.08)_48%,transparent_72%)] opacity-0 scale-[0.6] transition-[opacity,transform] duration-[400ms] ease-out group-hover:opacity-100 group-hover:scale-100"
                    aria-hidden
                  />
                  <span className="relative translate-y-[0.05em]" aria-hidden>
                    →
                  </span>
                </span>
              </span>
              <span
                className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-[#a39685]/90 transition-transform duration-[420ms] ease-[cubic-bezier(0.28,0.11,0.22,1)] group-hover:scale-x-100"
                aria-hidden
              />
            </div>
          </div>

          <div className="relative mx-auto mt-12 w-full max-w-[360px] md:mx-0 md:mt-0 md:w-full md:max-w-[min(100%,422px)]">
            <div
              className="relative w-full overflow-hidden rounded-[28px] border border-[#e0d5c9]/55 bg-[#ede6dd] shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_10px_30px_rgba(48,36,28,0.032)] transition-[box-shadow] duration-[300ms] ease-[cubic-bezier(0.28,0.11,0.22,1)] group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_13px_36px_rgba(48,36,28,0.045)]"
              style={{ aspectRatio: "8.45 / 7.82" }}
            >
              <div className="absolute inset-0 overflow-hidden">
                <Image
                  src="/diamond-tech-suite/dia-tech-homepage/home-tech-suite.png"
                  alt="Round diamond on the hand, studio preview"
                  fill
                  sizes="(max-width: 768px) 92vw, 422px"
                  className="origin-center translate-x-[7px] translate-y-[6px] scale-[0.9] object-contain object-[43%_50%]"
                />
              </div>
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 50% 28%, rgba(255,255,255,0.18), transparent 48%), linear-gradient(to top, rgba(245,238,228,0.1), transparent 64%)",
                }}
              />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
