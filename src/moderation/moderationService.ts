/**
 * moderationService.ts — central moderation pipeline.
 *
 * Flow:
 *   trigger → moderationService → analyzeContent(text, apiKey)
 *                               → decisionEngine (confidence threshold)
 *                               → actions (remove / report / ignore)
 *                               → storage (strikes, analytics)
 */
import type { AppContext } from "../types/devvit.js";
import { analyzeContent } from "../ai/moderationAnalyzer.js";
import { applyRemovalWithStrike, applyWarningOnly } from "./actions.js";
import type { ContentPayload } from "./types.js";
import { logger } from "../utils/logger.js";
import { cleanContent } from "../utils/textCleaner.js";
import { REDIS_KEYS, REDIS_TTLS } from "../constants/redisKeys.js";

export async function processModeration(
  context: AppContext,
  payload: ContentPayload
): Promise<void> {
  const { id, author, body, subreddit, permalink, kind } = payload;

  // ENSURE NO DUPLICATE PROCESSING (EARLY ENOUGH BEFORE ANY SIDE EFFECTS)
  const dedupeKey = REDIS_KEYS.moderationDedupe(id);
  const isDupe = await context.redis.get(dedupeKey);
  if (isDupe) {
    logger.info({ id, author, subreddit, kind }, "[DUPLICATE_EVENT_ABORTED]");
    return;
  }
  await context.redis.set(dedupeKey, "1", { expiration: new Date(Date.now() + REDIS_TTLS.moderationDedupeMs) });

  // [STAGE 2] Content received: Moderating comment/post by user TestUser
  logger.info(
    { username: author, contentKind: kind, contentId: id, subreddit, permalink },
    "[MODERATION_START]"
  );

  // 1. Get Gemini API key
  const apiKey = (await context.settings.get("gemini_api_key")) as string | undefined;
  if (!apiKey) {
    logger.warn({}, "gemini_api_key not set — skipping AI moderation");
    logger.info({ id, author, subreddit, kind }, "[MODERATION_END]");
    return;
  }

  // 2. Preprocessing & Logging
  const originalText = payload.liveBody || body;

  logger.debug({ id }, `[DEBUG] Trigger payload body: ${body}`);
  logger.debug({ id }, `[DEBUG] Live fetched body: ${payload.liveBody || ""}`);

  const cleanedBody = cleanContent(originalText);

  // [STAGE 3] Content cleaned logs
  logger.info(
    { originalBody: originalText, cleanedBody, cleanedLength: cleanedBody.length },
    "[STAGE 3] Content cleaned"
  );

  const textToAnalyze = cleanedBody || originalText;
  logger.debug({ id }, `[DEBUG] Final moderation body: ${textToAnalyze}`);
  logger.info({ id, textLength: textToAnalyze.length }, "moderation body chosen");

  // Prevent false empty skips: only skip if BOTH original body and live body are empty
  const isOriginalEmpty = !body || body.trim() === "";
  const isLiveEmpty = !payload.liveBody || payload.liveBody.trim() === "";
  if (isOriginalEmpty && isLiveEmpty) {
    logger.info({ id }, "Both original body and live fetched body are empty — skipping moderation");
    logger.info({ id, author, subreddit, kind }, "[MODERATION_END]");
    return;
  }

  // 4. Run AI classifier
  let analyzerOutput;
  try {
    logger.info({ id, author, len: textToAnalyze.length }, "Gemini request sent");
    analyzerOutput = await analyzeContent(textToAnalyze, apiKey, context.redis, subreddit);
    logger.info({ id, author }, "Gemini response received");
  } catch (err: any) {
    logger.error({ err: err?.message, id, author }, "analyzeContent failed");
    logger.info({ id, author, subreddit, kind }, "[MODERATION_END]");
    return;
  }

  if (!analyzerOutput || analyzerOutput.decisionLevel === "SAFE") {
    logger.info({ id, author }, "Content classified as SAFE");
    logger.info({ id, author, subreddit, kind }, "[MODERATION_END]");
    return;
  }

  // 5. Execute Action based on Decision Level
  const primaryViolation = analyzerOutput.violations[0] || {
    type: "toxicity",
    confidence: 1,
    reason: "Fallback",
    isImplicit: false
  };

  logger.info(
    { id, author, decisionLevel: analyzerOutput.decisionLevel, severityScore: analyzerOutput.severityScore },
    `[STAGE 6] Violation detected with level ${analyzerOutput.decisionLevel}`
  );

  if (analyzerOutput.decisionLevel === "LOW") {
    logger.info({ id, author }, "Routing to warning-only pipeline (LOW severity)");
    await applyWarningOnly(context, payload, primaryViolation);
    logger.info({ id, author }, "Warning pipeline completed");
  } else if (analyzerOutput.decisionLevel === "MEDIUM" || analyzerOutput.decisionLevel === "HIGH") {
    logger.info({ id, author }, `Routing to removal pipeline (${analyzerOutput.decisionLevel} severity)`);
    await applyRemovalWithStrike(context, payload, primaryViolation, analyzerOutput.decisionLevel);
    logger.info({ id, author }, "Removal pipeline completed");
  }

  logger.info({ id, author, subreddit, kind }, "[MODERATION_END]");
}
