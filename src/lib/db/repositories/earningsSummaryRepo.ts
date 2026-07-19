import type { DrizzleDB } from "../provider";
import { getKv, setKv } from "./appKvRepo";
import type { EarningsSummary } from "@/types";

const KV_KEY = "earnings_summary";

/** EarningsSummary is a single small blob, not a list — app_kv is a better fit than a
 *  dedicated table for the same reason dashboard stats would be: no rows to key on. */
export async function getCachedEarningsSummary(db: DrizzleDB): Promise<EarningsSummary | null> {
  const raw = await getKv(db, KV_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EarningsSummary;
  } catch {
    return null;
  }
}

export async function cacheEarningsSummary(db: DrizzleDB, summary: EarningsSummary): Promise<void> {
  await setKv(db, KV_KEY, JSON.stringify(summary));
}
