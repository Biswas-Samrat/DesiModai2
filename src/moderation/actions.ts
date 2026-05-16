/**
 * actions.ts — enforces the 3-strike policy after AI flags content.
 *
 * Strike 1 & 2: remove content + DM warning + add ModNote
 * Strike 3:     remove content + send ModMail to subreddit mods with evidence
 *               (NO auto-ban — violates Reddit policy)
 */
import type { TriggerContext } from "@devvit/public-api";
import type { ContentPayload, ViolationType } from "./types.js";
import { incrementStrikes, getStrikes } from "../storage/strikeStore.js";
import { logEscalation, logRemoval, logWarning } from "../storage/analyticsStore.js";
import { logger } from "../utils/logger.js";

const SUBREDDIT = "DesiModTest_Samrat";

function dmWarningText(strikeNum: number): string {
  return `Warning ${strikeNum}/3: Violation detected. Please follow r/${SUBREDDIT} rules.`;
}

function modMailBody(
  username: string,
  violation: { type: ViolationType; reason: string; confidence: number },
  permalink: string,
  strikes: number
): string {
  return (
    `User u/${username} has reached ${strikes} strikes.\n\n` +
    `**Violation type:** ${violation.type}\n` +
    `**Reason:** ${violation.reason}\n` +
    `**Confidence:** ${(violation.confidence * 100).toFixed(0)}%\n` +
    `**Evidence:** https://reddit.com${permalink}\n\n` +
    `⚠️ Please review manually. Do NOT auto-ban without human review.`
  );
}

/**
 * Removes content, increments the user's strike counter, sends a DM warning
 * (strikes 1–2) or ModMail to mods (strike 3+).
 */
export async function applyRemovalWithStrike(
  context: TriggerContext,
  payload: ContentPayload,
  violation: { type: ViolationType; reason: string; confidence: number }
): Promise<void> {
  // 1. Remove the content
  await context.reddit.remove(payload.id, false);
  await logRemoval(context.redis, violation.type);

  // 2. Increment strike counter
  const strikeCount = await incrementStrikes(context.redis, payload.author);

  // 3. Add a ModNote for the mod team
  const modNote =
    `[DesiMod AI] ${violation.type} ` +
    `| confidence=${(violation.confidence * 100).toFixed(0)}% ` +
    `| reason="${violation.reason}" | strike=${strikeCount}`;

  try {
    await context.reddit.addModNote({
      subreddit: payload.subreddit,
      user: payload.author,
      note: modNote,
      redditId: payload.id as `t1_${string}` | `t3_${string}`,
    });
  } catch (err) {
    logger.warn({ err, username: payload.author }, "addModNote failed (non-fatal)");
  }

  // 4. Strike 1 or 2 → DM user
  if (strikeCount <= 2) {
    try {
      await context.reddit.sendPrivateMessage({
        to: payload.author,
        subject: `Moderator Warning — Strike ${strikeCount}/3`,
        text: dmWarningText(strikeCount),
      });
      await logWarning(context.redis);
    } catch (err) {
      logger.warn({ err, username: payload.author }, "sendPrivateMessage failed (non-fatal)");
    }
    return;
  }

  // 5. Strike 3+ → ModMail to subreddit mods (NO ban)
  try {
    await context.reddit.sendPrivateMessage({
      to: `/r/${payload.subreddit}`,
      subject: `3-Strike Report: u/${payload.author}`,
      text: modMailBody(payload.author, violation, payload.permalink, strikeCount),
    });
    await logEscalation(
      context.redis,
      `https://reddit.com${payload.permalink}`,
      payload.author
    );
  } catch (err) {
    logger.warn({ err, username: payload.author }, "ModMail send failed (non-fatal)");
  }
}

/**
 * Reports content to Reddit's queue without removing it (low-confidence path).
 */
export async function applyReportOnly(
  context: TriggerContext,
  payload: ContentPayload,
  violation: { type: ViolationType; reason: string; confidence: number }
): Promise<void> {
  const reason = `[DesiMod AI] ${violation.type} confidence=${(violation.confidence * 100).toFixed(0)}% — ${violation.reason}`;

  try {
    if (payload.kind === "comment") {
      const comment = await context.reddit.getCommentById(payload.id);
      await context.reddit.report(comment, { reason });
    } else {
      const post = await context.reddit.getPostById(payload.id);
      await context.reddit.report(post, { reason });
    }
  } catch (err) {
    logger.warn({ err }, "report action failed (non-fatal)");
  }
}
