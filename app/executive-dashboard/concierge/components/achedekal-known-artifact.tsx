"use client";

import { useEffect, useState } from "react";
import {
  ACHEDEKAL_KNOWN_ARTIFACT_CLASSIFICATION,
  ACHEDEKAL_KNOWN_ARTIFACT_CLASSIFICATION_BASIS,
  ACHEDEKAL_KNOWN_ARTIFACT_FILENAME,
  ACHEDEKAL_KNOWN_ARTIFACT_PATH,
  ACHEDEKAL_KNOWN_ARTIFACT_SIZE_LABEL,
} from "@/lib/continuum/gmail/achedekal-acceptance";
import { ClientMemorySection } from "./client-memory-section";

const LOAD_FAILURE = "The known CAD artifact could not be loaded.";

export function AchedekalKnownArtifactPreview() {
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">(
    "idle",
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function loadKnownArtifact() {
    setStatus("loading");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    try {
      const response = await fetch(ACHEDEKAL_KNOWN_ARTIFACT_PATH, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setStatus("error");
        return;
      }
      const blob = await response.blob();
      setPreviewUrl(URL.createObjectURL(blob));
      setStatus("loaded");
    } catch {
      setStatus("error");
    }
  }

  return (
    <ClientMemorySection title="Known project artifact">
      <p className="text-[15px] text-[#efe8de]">{ACHEDEKAL_KNOWN_ARTIFACT_FILENAME}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-[#c4b7aa]">
        JPEG · {ACHEDEKAL_KNOWN_ARTIFACT_SIZE_LABEL}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-[#c4b7aa]">
        Source: stored exact project thread
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-[#c4b7aa]">
        Classification: {ACHEDEKAL_KNOWN_ARTIFACT_CLASSIFICATION}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-[#8d8073]">
        Based on {ACHEDEKAL_KNOWN_ARTIFACT_CLASSIFICATION_BASIS}. This does not
        visually prove a bracelet, ring, sold piece, or approved design.
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-[#c4b7aa]">
        Status:{" "}
        {status === "loaded"
          ? "Loaded for founder review"
          : status === "loading"
            ? "Loading…"
            : "Not loaded"}
      </p>
      <button
        type="button"
        disabled={status === "loading"}
        onClick={() => void loadKnownArtifact()}
        className="mt-6 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:text-[#8d8073]"
      >
        Preview known CAD artifact
      </button>
      {status === "error" ? (
        <p className="mt-6 text-[15px] leading-relaxed text-[#c4b7aa]" role="status">
          {LOAD_FAILURE}
        </p>
      ) : null}
      {previewUrl ? (
        <div className="mt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Known CAD artifact preview"
            className="max-h-[32rem] max-w-full"
          />
        </div>
      ) : null}
      <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        Transient preview · Not saved · No project changes
      </p>
    </ClientMemorySection>
  );
}
