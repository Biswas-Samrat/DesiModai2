/**
 * Per-user violation history for modmail escalation (metadata only).
 */
import type { ContentKind, ViolationType } from "../moderation/types.js";
import { REDIS_KEYS, REDIS_TTLS } from "../constants/redisKeys.js";
import type { RedisClient } from "./redisClient.js";

export type ViolationRecord = {
  strike: number;
  type: ViolationType;
  reason: string;
  confidence: number;
  kind: ContentKind;
  permalink: string;
  contentId: string;
  at: string;
};

const MAX_RECORDS = 10;

export async function appendViolationRecord(
  redis: RedisClient,
  subreddit: string,
  username: string,
  record: ViolationRecord
): Promise<void> {
  const key = REDIS_KEYS.violationHistory(subreddit, username);
  const raw = await redis.get(key);
  let list: ViolationRecord[] = [];

  if (raw) {
    try {
      list = JSON.parse(raw) as ViolationRecord[];
    } catch {
      list = [];
    }
  }

  const withoutDuplicate = list.filter((item) => item.contentId !== record.contentId);
  withoutDuplicate.push(record);
  const trimmed = withoutDuplicate.slice(-MAX_RECORDS);

  await redis.set(key, JSON.stringify(trimmed), {
    expiration: new Date(Date.now() + REDIS_TTLS.strikeExpirySeconds * 1000),
  });
}

export async function getViolationHistory(
  redis: RedisClient,
  subreddit: string,
  username: string
): Promise<ViolationRecord[]> {
  const raw = await redis.get(REDIS_KEYS.violationHistory(subreddit, username));
  if (!raw) return [];

  try {
    return JSON.parse(raw) as ViolationRecord[];
  } catch {
    return [];
  }
}
