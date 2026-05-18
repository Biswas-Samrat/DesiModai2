/**
 * redisKeys.ts — central repository of all Redis keys and TTL settings.
 */

export const REDIS_KEYS = {
  /** Lock to prevent concurrent moderation side-effects on the same contentId */
  moderationDedupe: (contentId: string) => `moderation:${contentId}`,
  
  /** Lock to prevent concurrent strike increments on the same contentId */
  strikeLock: (contentId: string) => `strike_lock:${contentId}`,
  
  /** Cooldown to limit warning DMs to one per 24 hours per user per subreddit */
  dmCooldown: (subreddit: string, author: string) => `dm_cooldown:${subreddit}:${author}`,
  
  /** Cooldown key for Gemini API requests */
  geminiRateLimit: (subredditName?: string) => 
    subredditName ? `gemini_last_request_time:${subredditName}` : "gemini_last_request_time",
  
  /** Key for storing strike counts per user */
  userStrikes: (username: string) => `user:${username}:strikes`,
  
  /** Key for storing moderator dashboard post ID */
  dashboardPostId: (subredditName: string) => `dashboard_post_id:${subredditName}`,
};

export const REDIS_TTLS = {
  /** 10 minutes in milliseconds */
  moderationDedupeMs: 10 * 60 * 1000,
  
  /** 10 minutes in milliseconds */
  strikeLockMs: 10 * 60 * 1000,
  
  /** 24 hours in milliseconds */
  dmCooldownMs: 24 * 60 * 60 * 1000,
  
  /** 24 hours in milliseconds */
  geminiRateLimitMs: 24 * 60 * 60 * 1000,
  
  /** 90 days in seconds */
  strikeExpirySeconds: 90 * 24 * 60 * 60,
};
