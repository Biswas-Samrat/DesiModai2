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

export async function processModeration(
  context: TriggerContext,
  payload: ContentPayload
): Promise<void> {
  const { id, author, body, subreddit, permalink, kind } = payload;

  // 1. Get Gemini API key from Devvit Settings (not process.env)
  const apiKey = (await context.settings.get("gemini_api_key")) as string | undefined;
  if (!apiKey) {
    logger.warn({}, "gemini_api_key not set — skipping AI moderation");
    return;
  }

  // 2. Skip duplicate content in the same 15-minute window
  const isDupe = await isDuplicateAndStore(context.redis, body);
  if (isDupe) {
    logger.info({ id, author }, "Skipping duplicate content");
    return;
  }

  // 3. Run unified AI classifier (toxicity + scam)
  let violations;
  try {
    violations = await analyzeContent(body, apiKey);
  } catch (err) {
    logger.error({ err, id, author }, "analyzeContent failed — skipping");
    return;
  }

  if (!violations || violations.length === 0) return;

  // 4. For each violation, apply the appropriate action
  for (const violation of violations) {
    const decision = getDecision(violation.confidence);
    logger.info({ id, author, kind, violation, decision }, "Moderation decision");

    if (decision === "remove") {
      await applyRemovalWithStrike(context, payload, violation);
    } else if (decision === "report") {
      await applyReportOnly(context, payload, violation);
    }
    // "ignore" → do nothing
  }
}
