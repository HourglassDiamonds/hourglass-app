import { loadOpenProjectWork } from "@/lib/continuum/client-memory/open-projects/load";
import { ConciergeShell } from "../components/concierge-shell";
import { ClientsHome, type ClientsHomePerson } from "../components/clients-home";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Clients",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeClientsPage() {
  const work = await loadOpenProjectWork();
  const seen = new Set<string>();
  const people: ClientsHomePerson[] = [];
  for (const project of work) {
    for (const person of project.people) {
      if (seen.has(person.personId)) continue;
      seen.add(person.personId);
      people.push({
        personId: person.personId,
        displayName: person.displayName,
        projectTitle: project.title,
      });
    }
  }
  people.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" }),
  );

  return (
    <ConciergeShell variant="book">
      <ClientsHome people={people} />
    </ConciergeShell>
  );
}
