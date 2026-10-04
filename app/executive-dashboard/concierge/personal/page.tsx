import { PersonalApp } from "./components/personal-app";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Personal",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default function ConciergePersonalPage() {
  return <PersonalApp section="today" />;
}
