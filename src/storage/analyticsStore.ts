/**
 * analyticsStore.ts — daily stats stored in Devvit's built-in Redis.
 *
 * Key format:
 *   stats:toxic:{YYYY-MM-DD}
 *   stats:scam:{YYYY-MM-DD}
 *   stats:warnings:{YYYY-MM-DD}
 *   stats:modmail:{YYYY-MM-DD}
 */
import type { RedisClient } from "./redisClient.js";
import type { ViolationType } from "../moderation/types.js";

export type DashboardStats = {
  toxicRemovals: number;
  scamRemovals: number;
  warnings: number;
  escalations: number;
  estimatedTimeSavedMinutes: number;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayKey(metric: string, dayIso: string): string {
  return `stats:${metric}:${dayIso}`;
}

export async function logRemoval(
  redis: RedisClient,
  type: ViolationType
): Promise<void> {
  const metric = type === "toxicity" ? "toxic" : "scam";
  await redis.incrBy(dayKey(metric, todayIso()), 1);
}

export async function logWarning(redis: RedisClient): Promise<void> {
  await redis.incrBy(dayKey("warnings", todayIso()), 1);
}

export async function logEscalation(
  redis: RedisClient,
  evidenceLink: string,
  username: string
): Promise<void> {
  const day = todayIso();
  await redis.incrBy(dayKey("modmail", day), 1);
  // Store evidence as a JSON string under a list key
  await redis.set(
    `modmail:evidence:${day}:${username}`,
    JSON.stringify({ username, evidenceLink, createdAt: new Date().toISOString() })
  );
}

/**
 * Sums stats across the last `days` days (1, 3, or 7).
 */
export async function getDashboardStats(
  redis: RedisClient,
  days: 1 | 3 | 7
): Promise<DashboardStats> {
  const safeDays = [1, 3, 7].includes(days) ? days : 1;
  const stats: DashboardStats = {
    toxicRemovals: 0,
    scamRemovals: 0,
    warnings: 0,
    escalations: 0,
    estimatedTimeSavedMinutes: 0,
  };

  for (let i = 0; i < safeDays; i++) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - i);
    const dayIso = day.toISOString().slice(0, 10);

    const [toxic, scam, warnings, modmail] = await Promise.all([
      redis.get(dayKey("toxic", dayIso)),
      redis.get(dayKey("scam", dayIso)),
      redis.get(dayKey("warnings", dayIso)),
      redis.get(dayKey("modmail", dayIso)),
    ]);

    stats.toxicRemovals += Number(toxic ?? 0);
    stats.scamRemovals += Number(scam ?? 0);
    stats.warnings += Number(warnings ?? 0);
    stats.escalations += Number(modmail ?? 0);
  }

  const totalHandled = stats.toxicRemovals + stats.scamRemovals;
  stats.estimatedTimeSavedMinutes = totalHandled * 3;

  return stats;
}
