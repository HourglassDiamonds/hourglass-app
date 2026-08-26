"use client";

import { useRef } from "react";
import QRCode from "react-qr-code";

export function CardQr({
  url,
  label,
}: {
  url: string;
  label: string;
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
    <div className="flex flex-col items-center">
      <div
        ref={frameRef}
        className="rounded-[24px] bg-[#efe8de] p-5"
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
      <button
        type="button"
        onClick={downloadSvg}
        className="mt-4 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        Download QR
      </button>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(url);
        }}
        className="mt-2 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        Copy link
      </button>
    </div>
  );
}
