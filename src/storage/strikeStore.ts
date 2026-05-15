/**
 * strikeStore.ts — 3-strike system stored in Devvit's built-in Redis.
 *
 * Keys:  "user:{username}:strikes"
 * TTL:   90 days = 7,776,000 seconds
 */
import type { RedisClient } from "./redisClient.js";

const STRIKE_TTL_SECONDS = 7_776_000; // 90 days

function strikeKey(username: string): string {
  return `user:${username}:strikes`;
}

/** Returns the current strike count for a user (0 if none). */
export async function getStrikes(
  redis: RedisClient,
  username: string
): Promise<number> {
  const value = await redis.get(strikeKey(username));
  return value ? Number(value) : 0;
}

/**
 * Increments the strike count and resets the 90-day TTL.
 * Returns the NEW strike count.
 */
export async function incrementStrikes(
  redis: RedisClient,
  username: string
): Promise<number> {
  const key = strikeKey(username);
  const newCount = await redis.incrBy(key, 1);
  await redis.expire(key, STRIKE_TTL_SECONDS);
  return newCount;
}

/** Resets strike count to 0. */
export async function resetStrikes(
  redis: RedisClient,
  username: string
): Promise<void> {
  await redis.set(strikeKey(username), "0");
}
