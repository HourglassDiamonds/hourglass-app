import { continuumEnvBadge } from "@/lib/continuum/runtime-env";

export function ContinuumEnvBadge() {
  const badge = continuumEnvBadge();
  if (!badge?.show) return null;
  return (
    <p
      data-continuum-env-badge
      data-continuum-env={badge.env}
      data-continuum-isolation={badge.isolation}
      className="hg-continuum-env-badge"
    >
      {badge.label}
    </p>
  );
}
