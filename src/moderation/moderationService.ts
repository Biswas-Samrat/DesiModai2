/**
 * moderationService.ts — central moderation pipeline.
 *
 * Flow:
 *   trigger → moderationService → analyzeContent(text, apiKey)
 *                               → decisionEngine (confidence threshold)
 *                               → actions (remove / report / ignore)
 *                               → storage (strikes, analytics)
 */
import { TriggerContext } from "@devvit/public-api";
import { analyzeContent } from "../ai/moderationAnalyzer.js";
import { getDecision } from "./decisionEngine.js";
import { applyRemovalWithStrike, applyReportOnly } from "./actions.js";
import { isDuplicateAndStore } from "../storage/dedupeStore.js";
import type { ContentPayload } from "./types.js";
import { logger } from "../utils/logger.js";
import { cleanContent } from "../utils/textCleaner.js";

export async function processModeration(
  context: TriggerContext,
  payload: ContentPayload
): Promise<void> {
  const { id, author, body, subreddit, permalink, kind } = payload;

  // [STAGE 2] Content received: Moderating comment/post by user TestUser
  logger.info(
    { username: author, contentKind: kind, contentId: id, permalink },
    `[STAGE 2] Content received: Moderating ${kind} by user ${author}`
  );

  // 1. Get Gemini API key
  const apiKey = (await context.settings.get("gemini_api_key")) as string | undefined;
  if (!apiKey) {
    logger.warn({}, "gemini_api_key not set — skipping AI moderation");
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
    return;
  }

  // 4. Run AI classifier
  let violations;
  try {
    logger.info({ id, author, len: textToAnalyze.length }, "Gemini request sent");
    violations = await analyzeContent(textToAnalyze, apiKey, context.redis);
    logger.info({ id, author }, "Gemini response received");
  } catch (err: any) {
    logger.error({ err: err?.message, id, author }, "analyzeContent failed");
    return;
  }

  if (!violations || violations.length === 0) {
    logger.info({ id, author }, "Content classified as SAFE");
    return;
  }

  // 5. Direct Triage: Route any Gemini result with isToxic === true OR isScam === true to applyRemovalWithStrike()
  const toxicOrScamViolation = violations.find(v => v.type === "toxicity" || v.type === "scam");
  if (toxicOrScamViolation) {
    logger.info(
      { id, author, type: toxicOrScamViolation.type },
      `[STAGE 6] Violation detected: ${toxicOrScamViolation.type}`
    );
    logger.info({ id, author }, "Routing to removal pipeline");
    await applyRemovalWithStrike(context, payload, toxicOrScamViolation);
    logger.info({ id, author }, "Removal pipeline completed");
  } else {
    // 6. Separate Detection from Actions: Map decisions first (fallback/legacy logic)
    const actionsToTake = violations.map(v => ({
      violation: v,
      decision: getDecision(v.confidence, v.isImplicit)
    }));

    // Execute actions based on priority (removal > report)
    const removalAction = actionsToTake.find(a => a.decision === "remove");
    const reportAction = actionsToTake.find(a => a.decision === "report");

    if (removalAction) {
      logger.info({ id, author }, "Routing to removal pipeline (fallback)");
      await applyRemovalWithStrike(context, payload, removalAction.violation);
      logger.info({ id, author }, "Removal pipeline completed (fallback)");
    } else if (reportAction) {
      await applyReportOnly(context, payload, reportAction.violation);
    } else {
      logger.info({ id, author }, "No action required for detected violations (low confidence)");
    }
  }
}


