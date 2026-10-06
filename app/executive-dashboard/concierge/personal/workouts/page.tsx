import { PerformanceApp } from "../performance-app";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workouts", robots: { index: false, follow: false } };

export default function PersonalWorkoutsPage() {
  return <PerformanceApp initialView="week" />;
}
