/**
 * locks.ts — distributed lock using Devvit's built-in Redis.
 *
 * Uses set-if-not-exists + expire for a simple advisory lock.
 * Note: Devvit's Redis does not support the SET NX PX compound command directly,
 * so we emulate it with a get-then-set pattern guarded by a unique token.
 */
import type { RedisClient } from "./redisClient.js";

export interface RedisLock {
  key: string;
  token: string;
}

function generateToken(): string {
  // Use crypto.randomUUID() which is available in the Devvit sandbox
  return crypto.randomUUID();
}

/**
 * Attempts to acquire an advisory lock.
 * Returns the lock object on success, null if the lock is already held.
 * @param redis  - context.redis
 * @param key    - lock key name
 * @param ttlSec - lock TTL in seconds (default 15s)
 */
export async function acquireLock(
  redis: RedisClient,
  key: string,
  ttlSec = 15
): Promise<RedisLock | null> {
  const existing = await redis.get(key);
  if (existing) return null; // Already locked

  const token = generateToken();
  await redis.set(key, token);
  await redis.expire(key, ttlSec);
  return { key, token };
}

/**
 * Releases a lock only if the stored token matches (prevents releasing someone else's lock).
 */
export async function releaseLock(
  redis: RedisClient,
  lock: RedisLock
): Promise<void> {
  const value = await redis.get(lock.key);
  if (value === lock.token) {
    await redis.del(lock.key);
  }
}
