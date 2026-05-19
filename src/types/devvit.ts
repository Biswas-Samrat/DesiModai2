import type { context, reddit, redis, settings } from "@devvit/web/server";

export type RedditClient = typeof reddit;
export type RedisClient = typeof redis;
export type SettingsClient = typeof settings;

export type AppContext = {
  reddit: RedditClient;
  redis: RedisClient;
  settings: SettingsClient;
  subredditId?: typeof context.subredditId;
  subredditName?: typeof context.subredditName;
  postId?: typeof context.postId;
};
