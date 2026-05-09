import type { TriggerContext } from "@devvit/public-api";
import { analyzeContent } from "../ai/moderationAnalyzer.js";
import { getDecision } from "./decisionEngine.js";
import type { ContentPayload } from "./types.js";
import { applyRemovalWithStrike, applyReportOnly } from "./actions.js";
import { isDuplicateAndStore } from "../storage/dedupeStore.js";
import { acquireLock, releaseLock } from "../storage/locks.js";
import { logger } from "../utils/logger.js";

export async function processModeration(
  context: TriggerContext,
  payload: ContentPayload
): Promise<void> {
  const lock = await acquireLock(`lock:moderation:${payload.id}`);
  if (!lock) {
    logger.info({ contentId: payload.id }, "Skipped due to active moderation lock");
    return;
  }

  try {
    const duplicate = await isDuplicateAndStore(payload.body);
    if (duplicate) {
      logger.info({ contentId: payload.id }, "Skipped duplicate content");
      return;
    }

    const violations = await analyzeContent(payload.body);
    for (const violation of violations) {
      const decision = getDecision(violation.confidence);
      logger.info(
        {
          contentId: payload.id,
          author: payload.author,
          type: violation.type,
          confidence: violation.confidence,
          decision
        },
        "Moderation decision"
      );

      if (decision === "remove") {
        await applyRemovalWithStrike(context, payload, violation);
      } else if (decision === "report") {
        await applyReportOnly(context, payload, violation);
      }
    }
  } finally {
    await releaseLock(lock);
  }
}
