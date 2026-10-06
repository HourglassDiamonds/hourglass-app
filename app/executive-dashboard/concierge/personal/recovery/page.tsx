import { PerformanceApp } from "../performance-app";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recovery", robots: { index: false, follow: false } };

export default function PersonalRecoveryPage() {
  return <PerformanceApp initialView="recovery" />;
}
