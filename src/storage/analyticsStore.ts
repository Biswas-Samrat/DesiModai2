import { getRedis } from "./redisClient.js";
import type { ViolationType } from "../moderation/types.js";

export interface DashboardStats {
  toxicRemovals: number;
  scamRemovals: number;
  warnings: number;
  escalations: number;
  estimatedTimeSavedMinutes: number;
}

function dayKey(dayIso: string, metric: string): string {
  return `stats:${dayIso}:${metric}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function logRemoval(type: ViolationType): Promise<void> {
  const redis = getRedis();
  const day = todayIso();
  await redis.incr(dayKey(day, type === "toxicity" ? "toxicRemovals" : "scamRemovals"));
}

export async function logWarning(): Promise<void> {
  const redis = getRedis();
  await redis.incr(dayKey(todayIso(), "warnings"));
}

export async function logEscalation(evidenceLink: string, username: string): Promise<void> {
  const redis = getRedis();
  const day = todayIso();
  await redis.incr(dayKey(day, "escalations"));
  await redis.lpush(
    `modmail:escalations:${day}`,
    JSON.stringify({ username, evidenceLink, createdAt: new Date().toISOString() })
  );
}

export async function getStatsForDays(days: number): Promise<DashboardStats> {
  const redis = getRedis();
  const safeDays = Number.isInteger(days) && days >= 1 && days <= 7 ? days : 1;
  const stats: DashboardStats = {
    toxicRemovals: 0,
    scamRemovals: 0,
    warnings: 0,
    escalations: 0,
    estimatedTimeSavedMinutes: 0
  };

  for (let i = 0; i < safeDays; i += 1) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - i);
    const dayIso = day.toISOString().slice(0, 10);
    const [toxic, scam, warnings, escalations] = await Promise.all([
      redis.get(dayKey(dayIso, "toxicRemovals")),
      redis.get(dayKey(dayIso, "scamRemovals")),
      redis.get(dayKey(dayIso, "warnings")),
      redis.get(dayKey(dayIso, "escalations"))
    ]);

    stats.toxicRemovals += Number(toxic ?? 0);
    stats.scamRemovals += Number(scam ?? 0);
    stats.warnings += Number(warnings ?? 0);
    stats.escalations += Number(escalations ?? 0);
  }

  const totalHandled = stats.toxicRemovals + stats.scamRemovals;
  stats.estimatedTimeSavedMinutes = totalHandled * 3;

  return stats;
}
