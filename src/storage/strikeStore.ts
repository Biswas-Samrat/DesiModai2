import { getRedis } from "./redisClient.js";

export async function incrementStrike(username: string): Promise<number> {
  const redis = getRedis();
  return redis.incr(`user:${username}:strikes`);
}

export async function getStrikeCount(username: string): Promise<number> {
  const redis = getRedis();
  const value = await redis.get(`user:${username}:strikes`);
  return value ? Number(value) : 0;
}
