"use client";

import { useRef } from "react";
import QRCode from "react-qr-code";

const ACTION_CLASS =
  "inline-flex min-h-12 w-full items-center justify-center rounded-[16px] border border-white/[0.12] bg-[#1d1916] px-3 text-[11px] uppercase tracking-[0.12em] text-[#efe8de] outline-none hover:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]";

export function CardQr({
  url,
  label,
  previewHref,
}: {
  url: string;
  label: string;
  previewHref?: string | null;
}) {
  const frameRef = useRef<HTMLDivElement>(null);

  function downloadSvg() {
    const svg = frameRef.current?.querySelector("svg");
    if (!svg) return;
    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "continuum-card-qr.svg";
    link.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="flex w-full flex-col items-center">
      <div
        ref={frameRef}
        className="rounded-[24px] bg-[#efe8de] p-5 md:p-6"
        aria-label={label}
      >
        <QRCode
          value={url}
          size={196}
          bgColor="#efe8de"
          fgColor="#14110f"
          style={{ height: "auto", maxWidth: "196px", width: "196px" }}
        />
      </div>
      <div className="mt-5 grid w-full max-w-[20rem] grid-cols-2 gap-2">
        <button type="button" onClick={downloadSvg} className={ACTION_CLASS}>
          Download QR
        </button>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(url);
          }}
          className={ACTION_CLASS}
        >
          Copy Link
        </button>
      </div>
      {previewHref ? (
        <a
          href={previewHref}
          target="_blank"
          rel="noreferrer"
          className={`${ACTION_CLASS} mt-2 max-w-[20rem] border-[#ad9164]/40`}
        >
          Preview Public Card
        </a>
      ) : null}
    </div>
  );
}
