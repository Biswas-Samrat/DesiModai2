/**
 * redisClient.ts — re-exports the Devvit Redis type for use across storage modules.
 *
 * There is NO external Redis (ioredis / Upstash). Devvit provides Redis through
 * context.redis in every trigger/menu-item handler.
 *
 * All storage functions accept `redis: RedisClient` as their first parameter,
 * which callers supply as `context.redis`.
 */
import type { RedisClient } from "@devvit/public-api";

export type { RedisClient };
