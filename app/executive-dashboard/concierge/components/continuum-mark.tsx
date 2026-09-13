import { CONTINUUM_ICON_192 } from "@/lib/continuum/pwa/config";

export function ContinuumMark({
  size = 44,
  decorative = false,
}: {
  size?: number;
  decorative?: boolean;
}) {
  return (
    // Founder artwork, resized only. Do not redraw.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={CONTINUUM_ICON_192}
      alt={decorative ? "" : "Continuum"}
      width={size}
      height={size}
      decoding="async"
      className="block rounded-[22%] object-cover"
      style={{ width: size, height: size }}
    />
  );
}
