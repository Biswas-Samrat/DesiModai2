import { z } from "zod";

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  REDIS_URL: z.string().url(),
  PINO_LOG_LEVEL: z.string().default("info"),
  SUBREDDIT_NAME: z.string().min(1).optional(),
  BOT_USERNAME: z.string().min(1).optional()
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;

  cachedEnv = envSchema.parse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    REDIS_URL: process.env.REDIS_URL,
    PINO_LOG_LEVEL: process.env.PINO_LOG_LEVEL,
    SUBREDDIT_NAME: process.env.SUBREDDIT_NAME,
    BOT_USERNAME: process.env.BOT_USERNAME
  });

  return cachedEnv;
}
