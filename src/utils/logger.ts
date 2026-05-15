/**
 * logger.ts — Devvit-compatible logger using console.
 *
 * Devvit runs in a sandboxed environment where pino is not available.
 * Use console.log/warn/error which Devvit surfaces in its log viewer.
 */

export const logger = {
  info:  (data: unknown, msg?: string) => console.log("[INFO]",  msg ?? "", data),
  warn:  (data: unknown, msg?: string) => console.warn("[WARN]",  msg ?? "", data),
  error: (data: unknown, msg?: string) => console.error("[ERROR]", msg ?? "", data),
  debug: (data: unknown, msg?: string) => console.log("[DEBUG]", msg ?? "", data),
};
