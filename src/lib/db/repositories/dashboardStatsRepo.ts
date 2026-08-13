import type { DrizzleDB } from "../provider";
import { getKv, setKv } from "./appKvRepo";
import type { DashboardStats } from "@/types";

const KV_KEY = "dashboard_stats";

/**
 * DashboardStats is one small blob (counts, this week's chart), not a list — same reasoning
 * as `earningsSummaryRepo`: there are no rows to key on, so a dedicated table would buy
 * nothing over `app_kv`.
 *
 * Worth caching despite being derived, live-ish data: without it the dashboard — the app's
 * landing screen — was the one data screen that showed a skeleton forever offline while
 * every list screen behind it rendered fine from cache.
 */
export async function getCachedDashboardStats(db: DrizzleDB): Promise<DashboardStats | null> {
  const raw = await getKv(db, KV_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DashboardStats;
  } catch {
    return null;
  }
}

export async function cacheDashboardStats(db: DrizzleDB, stats: DashboardStats): Promise<void> {
  await setKv(db, KV_KEY, JSON.stringify(stats));
}
