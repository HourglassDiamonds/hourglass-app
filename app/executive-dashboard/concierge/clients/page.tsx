import { loadOpenProjectWork } from "@/lib/continuum/client-memory/open-projects/load";
import { getAuthenticatedClientWebsiteIntakeReader } from "@/lib/continuum/client-memory/read/website-intake-load";
import {
  isFounderIdentityName,
  isVendorPerson,
} from "@/lib/continuum/candidates/founder-attention";
import { ConciergeShell } from "../components/concierge-shell";
import { ClientsHome, type ClientsHomePerson } from "../components/clients-home";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Clients",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeClientsPage() {
  const [work, intakeAccess] = await Promise.all([
    loadOpenProjectWork(),
    getAuthenticatedClientWebsiteIntakeReader(),
  ]);
  const intakes = intakeAccess.ok
    ? await intakeAccess.reader.listRecent().catch(() => [])
    : [];
  const seen = new Set<string>();
  const people: ClientsHomePerson[] = [];
  for (const project of work) {
    for (const person of project.people) {
      if (seen.has(person.personId)) continue;
      if (isFounderIdentityName(person.displayName)) continue;
      seen.add(person.personId);
      people.push({
        personId: person.personId,
        displayName: person.displayName,
        projectTitle: project.title,
        kind: isVendorPerson(person) ? "vendor" : "client",
      });
    }
  }
  for (const intake of intakes) {
    if (!intake.personId || seen.has(intake.personId)) continue;
    seen.add(intake.personId);
    people.push({
      personId: intake.personId,
      displayName: intake.fullName,
      projectTitle: intake.projectType,
      kind: "prospect",
    });
  }
  people.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" }),
  );

  return (
    <ConciergeShell variant="book">
      <ClientsHome people={people} intakes={intakes} />
    </ConciergeShell>
  );
}
