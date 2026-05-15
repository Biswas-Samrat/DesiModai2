/**
 * dedupeStore.ts — content deduplication using Devvit's built-in Redis.
 *
 * Uses SHA-256 hash of the normalized text as a Redis key.
 * TTL defaults to 15 minutes (900s) to avoid processing the same content twice.
 */
import type { RedisClient } from "./redisClient.js";

// SHA-256 without node:crypto (not available in Devvit sandbox)
async function sha256Hex(text: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(text.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Returns true if this exact content was already seen recently (and stores it if not).
 * @param redis   - context.redis
 * @param rawText - raw content to check
 * @param ttlSec  - dedup window in seconds (default 15 min)
 */
export async function isDuplicateAndStore(
  redis: RedisClient,
  rawText: string,
  ttlSec = 900
): Promise<boolean> {
  const hash = await sha256Hex(rawText);
  const key = `dedupe:${hash}`;
  const already = await redis.get(key);
  if (already) return true;
  await redis.set(key, "1");
  await redis.expire(key, ttlSec);
  return false;
}
