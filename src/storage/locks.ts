import { randomUUID } from "node:crypto";
import { getRedis } from "./redisClient.js";

export interface RedisLock {
  key: string;
  token: string;
}

export async function acquireLock(key: string, ttlMs = 15_000): Promise<RedisLock | null> {
  const redis = getRedis();
  const token = randomUUID();
  const ok = await redis.set(key, token, "PX", ttlMs, "NX");
  if (ok !== "OK") return null;
  return { key, token };
}

export async function releaseLock(lock: RedisLock): Promise<void> {
  const redis = getRedis();
  const value = await redis.get(lock.key);
  if (value === lock.token) {
    await redis.del(lock.key);
  }
}
