import { createHash } from "node:crypto";
import { getRedis } from "./redisClient.js";

export async function isDuplicateAndStore(rawText: string, ttlSec = 900): Promise<boolean> {
  const redis = getRedis();
  const hash = createHash("sha256").update(rawText.toLowerCase().trim()).digest("hex");
  const key = `dedupe:${hash}`;
  const already = await redis.exists(key);
  if (already) return true;
  await redis.setex(key, ttlSec, "1");
  return false;
}
