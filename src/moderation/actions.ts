/**
 * actions.ts — enforces the 3-strike policy after AI flags content.
 *
 * Strike 1 & 2: remove content + DM warning + add ModNote
 * Strike 3:     remove content + send ModMail to subreddit mods with evidence
 *               (NO auto-ban — violates Reddit policy)
 */
import type { TriggerContext } from "@devvit/public-api";
import type { ContentPayload, ViolationType } from "./types.js";
import { incrementStrikes } from "../storage/strikeStore.js";
import { logEscalation, logRemoval, logWarning } from "../storage/analyticsStore.js";
import { logger } from "../utils/logger.js";
import { safeAddModNote, safeSendPM, safeSendModmail, redactUsername, isValidRedditUsername } from "../utils/redditHelpers.js";

const SUBREDDIT = "DesiModTest_Samrat";

function dmWarningText(strikeNum: number): string {
  return (
    `Warning ${strikeNum}/3: Violation detected. Please follow r/${SUBREDDIT} rules.\n\n` +
    `If you believe this is an error, appeal via ModMail: https://reddit.com/message/compose?to=/r/DesiMod998`
  );
}

function modMailBody(
  username: string,
  violation: { type: ViolationType; reason: string; confidence: number },
  permalink: string,
  strikes: number,
  kind: "post" | "comment"
): string {
  return (
    `### ⚠️ 3-Strike Escalation: u/${username}\n\n` +
    `The user u/${username} has reached **${strikes} strikes**. Manual review required.\n\n` +
    `**AI Assessment:**\n` +
    `- **Violation Type:** ${violation.type}\n` +
    `- **Confidence:** ${(violation.confidence * 100).toFixed(0)}%\n` +
    `- **Reason:** ${violation.reason}\n\n` +
    `**Violation Details:**\n` +
    `- **Content Type:** ${kind}\n` +
    `- **Context Link:** https://reddit.com${permalink}\n\n` +
    `*Note: No auto-ban has been issued. Please evaluate for potential suspension.*`
  );
}

/**
 * Maps violation types to short descriptors for mod notes.
 */
function getShortReason(type: ViolationType): string {
  switch (type) {
    case "toxicity": return "Toxicity: moderator abuse/harassment";
    case "scam": return "Scam: suspicious promotion/spam";
    default: return "Policy violation";
  }
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
  const { author, subreddit, id, permalink, kind } = payload;
  const redactedAuthor = redactUsername(author);

  // 1. Log the action chosen
  logger.info(
    { username: author, redactedAuthor, type: violation.type, action: "remove", kind },
    `Starting applyRemovalWithStrike moderation pipeline for ${kind} by user ${author}`
  );

  // 2. Fetch and Remove the content (Stage 7 & 8)
  let removalSucceeded = false;
  try {
    logger.info({ id, author, redactedAuthor, kind, permalink }, `[STAGE 7] Removal started for ${kind} by user ${author}`);
    const thing =
      kind === "comment"
        ? await context.reddit.getCommentById(id)
        : await context.reddit.getPostById(id);

    await context.reddit.remove(thing.id, false);
    await logRemoval(context.redis, violation.type);
    removalSucceeded = true;
    logger.info({ id, author, redactedAuthor, kind, permalink }, `[STAGE 8] Removal completed successfully for ${kind} by user ${author}`);
    logger.info({ id, author }, "removal success");
  } catch (err: any) {
    logger.error({ err: err?.message, id, author, redactedAuthor, kind }, `[STAGE 8] Removal failed: ${err?.message || String(err)}`);
    logger.error({ err: err?.message, id, author }, "removal failure");
  }

  // 3. Increment strike counter (Stage 9)
  let strikeCount = 0;
  try {
    strikeCount = await incrementStrikes(context.redis, author);
    logger.info({ author, redactedAuthor, strikeCount }, `[STAGE 9] Strike incremented successfully for user ${author}. Total strikes: ${strikeCount}`);
    logger.info({ author, strikeCount }, "strike increment success");
  } catch (err: any) {
    logger.error({ err: err?.message, author, redactedAuthor }, `[STAGE 9] Strike increment failed: ${err?.message || String(err)}`);
    logger.error({ err: err?.message, author }, "strike increment failure");
  }

  // 4. Add a ModNote (Concise & Safe) (Stage 10)
  const shortReason = getShortReason(violation.type);
  const modNoteText = `[DesiMod AI] ${shortReason} | Strike: ${strikeCount} | Conf: ${(violation.confidence * 100).toFixed(0)}%`;

  try {
    if (isValidRedditUsername(author)) {
      await safeAddModNote(context.reddit, {
        subreddit,
        user: author,
        note: modNoteText,
        redditId: id as any,
      });
      logger.info({ author, redactedAuthor, action: "modnote" }, `[STAGE 10] Mod note added successfully for user ${author}`);
      logger.info({ author }, "ModNote success");
    } else {
      logger.warn(
        { author, redactedAuthor },
        `[STAGE 10] Skipping mod note: username is truly invalid or missing`
      );
    }
  } catch (err: any) {
    logger.error({ err: err?.message, author, redactedAuthor }, `[STAGE 10] Mod note addition failed: ${err?.message || String(err)}`);
    logger.error({ err: err?.message, author }, "ModNote failure");
  }

  // 5. Strike 1 or 2 → DM user (Stage 11)
  if (strikeCount <= 2) {
    try {
      if (isValidRedditUsername(author)) {
        await safeSendPM(context.reddit, {
          to: author,
          subject: `Moderator Warning — Strike ${strikeCount}/3`,
          text: dmWarningText(strikeCount),
        });
        await logWarning(context.redis);
        logger.info({ author, redactedAuthor, strikeCount, action: "dm" }, `[STAGE 11] Warning DM sent successfully to user ${author}`);
        logger.info({ author, strikeCount }, "warning DM success");
      } else {
        logger.warn(
          { author, redactedAuthor },
          `[STAGE 11] Skipping DM warning: username is truly invalid or missing`
        );
      }
    } catch (err: any) {
      logger.error({ err: err?.message, author, redactedAuthor }, `[STAGE 11] Warning DM failed: ${err?.message || String(err)}`);
      logger.error({ err: err?.message, author }, "warning DM failure");
    }
  } else {
    // 6. Strike 3+ → Modmail report to moderators (Stage 12)
    try {
      if (isValidRedditUsername(author)) {
        await safeSendModmail(context.reddit, {
          subredditId: context.subredditId,
          subject: `3-Strike Report: u/${author}`,
          body: modMailBody(author, violation, permalink, strikeCount, kind),
        });
        await logEscalation(context.redis, `https://reddit.com${permalink}`, author);
        logger.info({ author, redactedAuthor, strikeCount, action: "modmail" }, `[STAGE 12] Modmail sent successfully for user ${author}`);
        logger.info({ author, strikeCount }, "modmail success");
      } else {
        logger.warn(
          { author, redactedAuthor },
          `[STAGE 12] Skipping Modmail: username is truly invalid or missing`
        );
      }
    } catch (err: any) {
      logger.error({ err: err?.message, author, redactedAuthor }, `[STAGE 12] Modmail failed: ${err?.message || String(err)}`);
      logger.error({ err: err?.message, author }, "modmail failure");
    }
  }
}

/**
 * Reports content without removing it.
 */
export async function applyReportOnly(
  context: TriggerContext,
  payload: ContentPayload,
  violation: { type: ViolationType; reason: string; confidence: number }
): Promise<void> {
  const reason = `[DesiMod AI] ${violation.type} (Conf: ${(violation.confidence * 100).toFixed(0)}%)`;

  try {
    const thing = payload.kind === "comment"
      ? await context.reddit.getCommentById(payload.id)
      : await context.reddit.getPostById(payload.id);

    await context.reddit.report(thing, { reason });
    logger.info({ author: payload.author, type: violation.type, action: "report" }, "Content reported");
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Report action failed");
  }
}

