/** Subtle facet geometry — decorative editorial anchor, not imagery. */

type DiEditorialFacetMotifProps = {
  variant?: "hero" | "notice";
  className?: string;
};

export default function DiEditorialFacetMotif({
  variant = "hero",
  className = "",
}: DiEditorialFacetMotifProps) {
  const stroke =
    variant === "hero" ? "rgba(139,115,91,0.08)" : "rgba(139,115,91,0.12)";

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      <svg
        className={
          variant === "hero"
            ? "absolute -right-[8%] top-[2%] h-[min(520px,70vw)] w-[min(520px,70vw)] opacity-90"
            : "absolute -left-[6%] bottom-[-10%] h-[min(420px,55vw)] w-[min(420px,55vw)] opacity-80"
        }
        viewBox="0 0 400 400"
        fill="none"
      >
        <polygon
          points="200,24 360,120 320,320 80,320 40,120"
          stroke={stroke}
          strokeWidth="1"
        />
        <polygon
          points="200,80 300,140 280,280 120,280 100,140"
          stroke={stroke}
          strokeWidth="0.75"
        />
        <line x1="200" y1="24" x2="200" y2="320" stroke={stroke} strokeWidth="0.5" />
        <line x1="40" y1="120" x2="360" y2="120" stroke={stroke} strokeWidth="0.5" />
        <line x1="80" y1="320" x2="320" y2="320" stroke={stroke} strokeWidth="0.5" />
        <line x1="100" y1="140" x2="300" y2="140" stroke={stroke} strokeWidth="0.5" />
        <line x1="120" y1="280" x2="280" y2="280" stroke={stroke} strokeWidth="0.5" />
        <circle cx="200" cy="200" r="118" stroke={stroke} strokeWidth="0.4" />
      </svg>
    </div>
  );
}
