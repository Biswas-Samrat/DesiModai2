/**
 * env.ts — safe build-time config only.
 *
 * IMPORTANT: Do NOT read GEMINI_API_KEY or REDIS_URL from here.
 * - GEMINI_API_KEY comes from context.settings.get("gemini_api_key") at runtime.
 * - Redis is provided by Devvit's built-in context.redis — no external URL needed.
 */

export const LOG_LEVEL = "info";
export const SUBREDDIT_NAME = "DesiModTest_Samrat";
