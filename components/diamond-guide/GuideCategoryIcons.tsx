import type { SVGProps } from "react";

export type GuideIconProps = SVGProps<SVGSVGElement>;

const sharedProps = {
  viewBox: "0 0 32 32",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export function DiamondSizeIcon(props: GuideIconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M6.25 10.25h19.5L16 25.75 6.25 10.25Z" />
      <path d="m6.25 10.25 4.25-4h11l4.25 4" />
      <path d="m10.5 6.25 2.75 4L16 6.25l2.75 4 2.75-4" />
      <path d="m10.5 10.25 5.5 15.5 5.5-15.5" />
      <path d="M6.25 10.25h19.5" />
    </svg>
  );
}

export function DiamondShapesIcon(props: GuideIconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M11 5.75h10l5.25 5.25v10L21 26.25H11L5.75 21V11L11 5.75Z" />
      <path d="M12.5 8.75h7l3.75 3.75v7l-3.75 3.75h-7L8.75 19.5v-7l3.75-3.75Z" />
      <path d="M11 5.75 12.5 8.75M21 5.75 19.5 8.75M26.25 11 23.25 12.5M26.25 21 23.25 19.5M21 26.25 19.5 23.25M11 26.25 12.5 23.25M5.75 21 8.75 19.5M5.75 11 8.75 12.5" />
    </svg>
  );
}

export function DiamondCutIcon(props: GuideIconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M16 4.75c3.2 2.45 6.15 3.65 9.25 4v7.5c0 5.55-3.45 9-9.25 11-5.8-2-9.25-5.45-9.25-11v-7.5c3.1-.35 6.05-1.55 9.25-4Z" />
      <path d="M16 8.25c2.15 1.55 4.15 2.4 6.25 2.75v5.2c0 3.75-2.25 6.15-6.25 7.75-4-1.6-6.25-4-6.25-7.75V11c2.1-.35 4.1-1.2 6.25-2.75Z" />
      <path d="M12.25 15.5 16 12l3.75 3.5L16 20l-3.75-4.5Z" />
    </svg>
  );
}

export function LightPerformanceIcon(props: GuideIconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M16 3.75v6M16 22.25v6M3.75 16h6M22.25 16h6" />
      <path d="m7.35 7.35 4.25 4.25M20.4 20.4l4.25 4.25M24.65 7.35 20.4 11.6M11.6 20.4l-4.25 4.25" />
      <path d="m16 10.25 1.75 4L22 16l-4.25 1.75L16 22l-1.75-4.25L10 16l4.25-1.75L16 10.25Z" />
      <circle cx="16" cy="16" r="1.25" />
    </svg>
  );
}

export function DiamondColorIcon(props: GuideIconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <circle cx="12" cy="12.25" r="7" />
      <circle cx="20" cy="12.25" r="7" />
      <circle cx="16" cy="19.25" r="7" />
      <path d="M16 6.55a7.02 7.02 0 0 1 0 11.4 7.02 7.02 0 0 1 0-11.4Z" />
      <path d="M10 16.75a7.02 7.02 0 0 1 12 0 7 7 0 0 1-12 0Z" />
    </svg>
  );
}

export function DiamondClarityIcon(props: GuideIconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <circle cx="13.25" cy="13.25" r="7.75" />
      <path d="m18.75 18.75 7.5 7.5" />
      <path d="m10.25 13.5 2-2.2 2.1 1.55 2.4-2.6" />
      <circle cx="13.3" cy="13.2" r=".65" />
    </svg>
  );
}

export function CertificationIcon(props: GuideIconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M8 4.75h10.25L24 10.5v16.75H8V4.75Z" />
      <path d="M18.25 4.75v5.75H24" />
      <path d="M11.5 15h9M11.5 18.5h9M11.5 22h5.5" />
      <path d="m20.25 21.2 1.35 1.35 2.75-3" />
    </svg>
  );
}

export function BuyingStrategyIcon(props: GuideIconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M16 5v22M10.5 27h11" />
      <path d="M8 8.5h16" />
      <path d="m8 8.5-4.5 8h9l-4.5-8ZM24 8.5l-4.5 8h9l-4.5-8Z" />
      <path d="M3.5 16.5c.65 2 2.1 3 4.5 3s3.85-1 4.5-3M19.5 16.5c.65 2 2.1 3 4.5 3s3.85-1 4.5-3" />
      <circle cx="16" cy="8.5" r="1.25" />
    </svg>
  );
}

export function ProposalPlanningIcon(props: GuideIconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <ellipse cx="16" cy="19.25" rx="8.25" ry="8" />
      <path d="m12.25 8.5 3.75-4 3.75 4-3.75 4-3.75-4Z" />
      <path d="M12.25 8.5h7.5M16 4.5v8" />
      <path d="M11.5 12.25c1.3-1.2 2.8-1.75 4.5-1.75s3.2.55 4.5 1.75" />
    </svg>
  );
}

export function CharlotteGuidesIcon(props: GuideIconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M16 5.25c-4.05 0-7.35 3.2-7.35 7.15 0 5.35 7.35 14.35 7.35 14.35s7.35-9 7.35-14.35c0-3.95-3.3-7.15-7.35-7.15Z" />
      <path d="M16 8.6 13.55 11.2 16 16.15l2.45-4.95L16 8.6Z" />
      <path d="M13.55 11.2h4.9" />
    </svg>
  );
}
