import { ChiefOfStaffPersistenceError } from "./errors";
import type { AttentionItem } from "../types";
import type { EntityKind, EntityKindReader } from "./contract";

export async function assertAttentionEntityKinds(
  item: AttentionItem,
  reader: EntityKindReader,
): Promise<void> {
  if (item.personId) {
    await assertEntityKind(item.personId, "person", reader);
  }
  if (item.projectId) {
    await assertEntityKind(item.projectId, "project", reader);
  }
}

async function assertEntityKind(
  id: string,
  expected: "person" | "project",
  reader: EntityKindReader,
): Promise<void> {
  const kind: EntityKind | null = await reader.getKind(id);
  if (kind == null) {
    throw new ChiefOfStaffPersistenceError("entity-not-found");
  }
  if (kind !== expected) {
    throw new ChiefOfStaffPersistenceError("entity-kind-invalid");
  }
}
