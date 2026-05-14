import { Redis } from "ioredis";
import { getEnv } from "../utils/env.js";
import { logger } from "../utils/logger.js";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (redis) return redis;

  const redisUrl = getEnv().REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL environment variable is not set");
  }

  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });

  redis.on("error", (error: Error) => {
    logger.error({ error }, "Redis error");
  });

  return redis;
}
