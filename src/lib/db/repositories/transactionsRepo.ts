import type { DrizzleDB } from "../provider";
import { transactions } from "../schema";
import type { Transaction } from "@/types";

function fromRow(row: typeof transactions.$inferSelect): Transaction {
  return {
    id: row.id,
    patientName: row.patientName,
    amount: row.amount,
    type: row.type as Transaction["type"],
    status: row.status as Transaction["status"],
    date: row.date,
    dateLabel: row.dateLabel,
    sessionType: (row.sessionType ?? undefined) as Transaction["sessionType"],
  };
}

export async function getCachedTransactions(db: DrizzleDB): Promise<Transaction[]> {
  const rows = await db.select().from(transactions);
  return rows.map(fromRow);
}

export async function cacheTransactions(db: DrizzleDB, list: Transaction[]): Promise<void> {
  const cachedAt = Date.now();
  await db.transaction(async (tx) => {
    await tx.delete(transactions);
    if (list.length === 0) return;
    await tx.insert(transactions).values(
      list.map((t) => ({
        id: t.id,
        patientName: t.patientName,
        amount: t.amount,
        type: t.type,
        status: t.status,
        date: t.date,
        dateLabel: t.dateLabel,
        sessionType: t.sessionType ?? null,
        cachedAt,
      })),
    );
  });
}
