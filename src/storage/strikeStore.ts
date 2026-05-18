/**
 * strikeStore.ts — 3-strike system stored in Devvit's built-in Redis.
 */
import type { RedisClient } from "./redisClient.js";
import { REDIS_KEYS, REDIS_TTLS } from "../constants/redisKeys.js";

/** Returns the current strike count for a user (0 if none). */
export async function getStrikes(
  redis: RedisClient,
  username: string
): Promise<number> {
  const value = await redis.get(REDIS_KEYS.userStrikes(username));
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
  const key = REDIS_KEYS.userStrikes(username);
  const newCount = await redis.incrBy(key, 1);
  await redis.expire(key, REDIS_TTLS.strikeExpirySeconds);
  return newCount;
}

/** Resets strike count to 0. */
export async function resetStrikes(
  redis: RedisClient,
  username: string
): Promise<void> {
  await redis.set(REDIS_KEYS.userStrikes(username), "0");
}
