import type { DrizzleDB } from "../provider";
import { notifications } from "../schema";
import type { AppNotification } from "@/types";

function fromRow(row: typeof notifications.$inferSelect): AppNotification {
  return {
    id: row.id,
    type: row.type as AppNotification["type"],
    title: row.title,
    body: row.body,
    timestamp: row.timestamp,
    read: row.read,
    actionUrl: row.actionUrl ?? undefined,
  };
}

export async function getCachedNotifications(db: DrizzleDB): Promise<AppNotification[]> {
  const rows = await db.select().from(notifications);
  return rows.map(fromRow);
}

export async function cacheNotifications(db: DrizzleDB, list: AppNotification[]): Promise<void> {
  const cachedAt = Date.now();
  await db.transaction(async (tx) => {
    await tx.delete(notifications);
    if (list.length === 0) return;
    await tx.insert(notifications).values(
      list.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        timestamp: n.timestamp,
        read: n.read,
        actionUrl: n.actionUrl ?? null,
        cachedAt,
      })),
    );
  });
}
