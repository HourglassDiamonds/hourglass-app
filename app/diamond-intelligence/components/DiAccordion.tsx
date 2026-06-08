"use client";

import { useId, useState, type ReactNode } from "react";

export default function DiAccordion({
  title,
  description,
  children,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="border-b border-[#e4dbcf]/50 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-6 py-5 text-left transition-colors hover:text-[#1f1d1a] md:py-6"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-[1.15rem] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.22rem]">
            {title}
          </span>
          {description && !open ? (
            <span className="mt-1.5 block text-[0.9rem] leading-[1.65] text-[#8a8177]">
              {description}
            </span>
          ) : null}
        </span>
        <span
          className={`mt-1 shrink-0 text-[#948a80] transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
            <path
              d="M1 1.5L7 6.5L13 1.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="pb-6 md:pb-8"
      >
        {children}
      </div>
    </div>
  );
}
