import Redis from "ioredis";
import { getEnv } from "../utils/env.js";
import { logger } from "../utils/logger.js";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (redis) return redis;

  redis = new Redis(getEnv().REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false
  });

  redis.on("error", (error) => {
    logger.error({ error }, "Redis error");
  });

  return redis;
}
