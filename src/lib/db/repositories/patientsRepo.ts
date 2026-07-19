import type { DrizzleDB } from "../provider";
import { patients } from "../schema";
import type { Patient } from "@/types";

function fromRow(row: typeof patients.$inferSelect): Patient {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    gender: row.gender as Patient["gender"],
    phone: row.phone,
    condition: row.condition,
    avatarUrl: row.avatarUrl ?? undefined,
    address: row.address ?? undefined,
    totalSessions: row.totalSessions,
    lastVisit: row.lastVisit ?? undefined,
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : [],
  };
}

export async function getCachedPatients(db: DrizzleDB): Promise<Patient[]> {
  const rows = await db.select().from(patients);
  return rows.map(fromRow);
}

/** Replaces the whole cache with the latest server snapshot — simplest correct semantics
 *  for a read-through list cache (a patient removed server-side shouldn't linger locally). */
export async function cachePatients(db: DrizzleDB, list: Patient[]): Promise<void> {
  const cachedAt = Date.now();
  await db.transaction(async (tx) => {
    await tx.delete(patients);
    if (list.length === 0) return;
    await tx.insert(patients).values(
      list.map((p) => ({
        id: p.id,
        name: p.name,
        age: p.age,
        gender: p.gender,
        phone: p.phone,
        condition: p.condition,
        avatarUrl: p.avatarUrl ?? null,
        address: p.address ?? null,
        totalSessions: p.totalSessions,
        lastVisit: p.lastVisit ?? null,
        tags: JSON.stringify(p.tags),
        cachedAt,
      })),
    );
  });
}
