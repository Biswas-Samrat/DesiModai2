/**
 * actions.ts — enforces the 3-strike policy after AI flags content.
 *
 * Strike 1 & 2:
 * - remove content
 * - increment strike
 * - send DM warning
 * - add ModNote
 *
 * Strike 3+:
 * - remove content
 * - increment strike
 * - send ModMail to subreddit moderators
 * - NO auto-ban (Reddit policy safe)
 */

import type { AppContext } from "../types/devvit.js";
import type { ContentPayload, ViolationType } from "./types.js";

import {
  getStrikes,
  incrementStrikes,
} from "../storage/strikeStore.js";

import {
  logEscalation,
  logRemoval,
  logWarning,
} from "../storage/analyticsStore.js";
import { broadcastDashboardRefresh } from "../server/dashboardRealtime.js";

import { logger } from "../utils/logger.js";

import {
  safeAddModNote,
  safeSendPM,
  safeSendModmail,
  redactUsername,
  isValidRedditUsername,
} from "../utils/redditHelpers.js";

import {
  REDIS_KEYS,
  REDIS_TTLS,
} from "../constants/redisKeys.js";

/**
 * Creates DM warning text
 */
function dmWarningText(
  strikeNum: number,
  subreddit: string
): string {
  return (
    `Warning ${strikeNum}/3: Violation detected. Please follow r/${subreddit} rules.\n\n` +
    `If you believe this is an error, appeal via ModMail: https://reddit.com/message/compose?to=/r/${subreddit}`
  );
}

/**
 * Creates ModMail body
 */
function modMailBody(
  username: string,
  violation: {
    type: ViolationType;
    reason: string;
    confidence: number;
  },
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
 * Short reason for ModNote
 */
function getShortReason(type: ViolationType): string {
  switch (type) {
    case "toxicity":
      return "Toxicity: moderator abuse/harassment";

    case "scam":
      return "Scam: suspicious promotion/spam";

    default:
      return "Policy violation";
  }
}

/**
 * Warning-only action
 */
export async function applyWarningOnly(
  context: AppContext,
  payload: ContentPayload,
  violation: {
    type: ViolationType;
    reason: string;
    confidence: number;
  }
): Promise<void> {
  const { author, subreddit } = payload;

  const redactedAuthor = redactUsername(author);

  logger.info(
    { username: author },
    `Starting applyWarningOnly pipeline for user ${author}`
  );

  if (isValidRedditUsername(author)) {
    try {
      await safeSendPM(context.reddit, {
        to: author,
        subject: `Moderator Warning — Policy Violation`,
        text:
          `Warning: Violation detected. Please follow rules.\n\n` +
          `If you believe this is an error, appeal via ModMail.`,
      });

      await logWarning(context.redis);
      await broadcastDashboardRefresh(context.subredditId);

      logger.info(
        { author, redactedAuthor, action: "dm" },
        "warning DM success"
      );
    } catch (err: any) {
      logger.error(
        { err: err?.message, author },
        "warning DM failure"
      );
    }
  }
}

/**
 * Main moderation removal pipeline
 */
export async function applyRemovalWithStrike(
  context: AppContext,
  payload: ContentPayload,
  violation: {
    type: ViolationType;
    reason: string;
    confidence: number;
  },
  decisionLevel: "MEDIUM" | "HIGH"
): Promise<void> {
  const {
    author,
    subreddit,
    id,
    permalink,
    kind,
  } = payload;

  const redactedAuthor = redactUsername(author);

  /**
   * =========================================
   * 1. Duplicate protection lock
   * =========================================
   */

  const strikeLockKey = REDIS_KEYS.strikeLock(id);

  const isStrikeLocked =
    await context.redis.get(strikeLockKey);

  if (isStrikeLocked) {
    logger.info(
      { id, author, subreddit },
      "[STRIKE_DUPLICATE_SKIPPED]"
    );

    return;
  }

  await context.redis.set(
    strikeLockKey,
    "1",
    {
      expiration: new Date(
        Date.now() + REDIS_TTLS.strikeLockMs
      ),
    }
  );

  /**
   * =========================================
   * 2. Log moderation start
   * =========================================
   */

  logger.info(
    {
      username: author,
      redactedAuthor,
      type: violation.type,
      action: "remove",
      kind,
    },
    `Starting applyRemovalWithStrike moderation pipeline for ${kind} by user ${author}`
  );

  /**
   * =========================================
   * 3. Remove content
   * =========================================
   */

  try {
    logger.info(
      {
        id,
        author,
        redactedAuthor,
        kind,
        permalink,
      },
      `[STAGE 7] Removal started for ${kind} by user ${author}`
    );

    const thing =
      kind === "comment"
        ? await context.reddit.getCommentById(id as `t1_${string}`)
        : await context.reddit.getPostById(id as `t3_${string}`);

    await context.reddit.remove(thing.id, false);

    await logRemoval(context.redis, violation.type);
    await broadcastDashboardRefresh(context.subredditId);

    logger.info(
      {
        id,
        author,
        redactedAuthor,
        kind,
        permalink,
      },
      `[STAGE 8] Removal completed successfully for ${kind} by user ${author}`
    );

    logger.info(
      { id, author },
      "removal success"
    );
  } catch (err: any) {
    logger.error(
      {
        err: err?.message,
        id,
        author,
        redactedAuthor,
        kind,
      },
      `[STAGE 8] Removal failed: ${err?.message || String(err)}`
    );

    logger.error(
      { err: err?.message, id, author },
      "removal failure"
    );
  }

  /**
   * =========================================
   * 4. Increment strikes
   * =========================================
   */

  let strikeCount = 0;

  try {
    logger.info(
      { author, redactedAuthor },
      "[STRIKE_INCREMENT_START]"
    );

    const previousStrikeCount =
      await getStrikes(context.redis, author);

    strikeCount =
      await incrementStrikes(context.redis, author);

    /**
     * HIGH severity = double strike
     */
    if (decisionLevel === "HIGH") {
      strikeCount =
        await incrementStrikes(context.redis, author);
    }

    const updatedStrikeCount = strikeCount;

    logger.info(
      {
        author,
        redactedAuthor,
        previousStrikeCount,
        updatedStrikeCount,
      },
      `[STRIKE_INCREMENT_END] Strike incremented successfully for user ${author}. previousStrikeCount: ${previousStrikeCount}, updatedStrikeCount: ${updatedStrikeCount}`
    );
  } catch (err: any) {
    logger.error(
      {
        err: err?.message,
        author,
        redactedAuthor,
      },
      `[STAGE 9] Strike increment failed: ${err?.message || String(err)}`
    );

    logger.error(
      { err: err?.message, author },
      "strike increment failure"
    );
  }

  /**
   * =========================================
   * 5. Add ModNote
   * =========================================
   */

  const shortReason =
    getShortReason(violation.type);

  const modNoteText =
    `[DesiMod AI] ${shortReason} | ` +
    `Strike: ${strikeCount} | ` +
    `Conf: ${(violation.confidence * 100).toFixed(0)}%`;

  try {
    if (isValidRedditUsername(author)) {
      await safeAddModNote(context.reddit, {
        subreddit,
        user: author,
        note: modNoteText,
        redditId: id as any,
      });

      logger.info(
        {
          author,
          redactedAuthor,
          action: "modnote",
        },
        `[STAGE 10] Mod note added successfully for user ${author}`
      );

      logger.info(
        { author },
        "ModNote success"
      );
    } else {
      logger.warn(
        { author, redactedAuthor },
        `[STAGE 10] Skipping mod note: username invalid`
      );
    }
  } catch (err: any) {
    logger.error(
      {
        err: err?.message,
        author,
        redactedAuthor,
      },
      `[STAGE 10] Mod note addition failed: ${err?.message || String(err)}`
    );

    logger.error(
      { err: err?.message, author },
      "ModNote failure"
    );
  }

  /**
   * =========================================
   * 6. Strike 1 & 2 → Send DM
   * =========================================
   */

  if (strikeCount <= 2) {
    try {
      if (isValidRedditUsername(author)) {

        /**
         * Prevent duplicate DM
         * ONLY for same strike level
         */

        const strikeDmKey =
          `desimod:last_dm_strike:${subreddit}:${author}`;

        const lastStrikeDm =
          await context.redis.get(strikeDmKey);

        /**
         * Send DM only if this strike
         * has not already been sent
         */

        if (lastStrikeDm !== String(strikeCount)) {

          await safeSendPM(context.reddit, {
            to: author,

            subject:
              `Moderator Warning — Strike ${strikeCount}/3`,

            text: dmWarningText(
              strikeCount,
              subreddit
            ),
          });

          /**
           * Store last DM strike
           */

          await context.redis.set(
            strikeDmKey,
            String(strikeCount),
            {
              expiration: new Date(
                Date.now() + REDIS_TTLS.dmCooldownMs
              ),
            }
          );

          await logWarning(context.redis);
          await broadcastDashboardRefresh(context.subredditId);

          logger.info(
            {
              author,
              redactedAuthor,
              strikeCount,
              action: "dm",
            },
            `[STAGE 11] Warning DM sent successfully to user ${author}`
          );

          logger.info(
            { author, strikeCount },
            "warning DM success"
          );

        } else {

          logger.info(
            {
              author,
              redactedAuthor,
              strikeCount,
            },
            "[DUPLICATE_STRIKE_DM_SKIPPED]"
          );

        }

      } else {

        logger.warn(
          { author, redactedAuthor },
          `[STAGE 11] Skipping DM warning: username invalid`
        );

      }

    } catch (err: any) {

      logger.error(
        {
          err: err?.message,
          author,
          redactedAuthor,
        },
        `[STAGE 11] Warning DM failed: ${err?.message || String(err)}`
      );

      logger.error(
        { err: err?.message, author },
        "warning DM failure"
      );

    }
  }

  /**
   * =========================================
   * 7. Strike 3+ → Send ModMail
   * =========================================
   */

  else {
    try {
      if (isValidRedditUsername(author)) {

        await safeSendModmail(context.reddit, {
          subredditId: context.subredditId ?? payload.subreddit,

          subject:
            `3-Strike Report: u/${author}`,

          body: modMailBody(
            author,
            violation,
            permalink,
            strikeCount,
            kind
          ),
        });

        await logEscalation(
          context.redis,
          `https://reddit.com${permalink}`,
          author
        );
        await broadcastDashboardRefresh(context.subredditId);

        logger.info(
          {
            author,
            redactedAuthor,
            strikeCount,
            action: "modmail",
          },
          `[STAGE 12] Modmail sent successfully for user ${author}`
        );

        logger.info(
          { author, strikeCount },
          "modmail success"
        );

      } else {

        logger.warn(
          { author, redactedAuthor },
          `[STAGE 12] Skipping Modmail: username invalid`
        );

      }

    } catch (err: any) {

      logger.error(
        {
          err: err?.message,
          author,
          redactedAuthor,
        },
        `[STAGE 12] Modmail failed: ${err?.message || String(err)}`
      );

      logger.error(
        { err: err?.message, author },
        "modmail failure"
      );

    }
  }
}

/**
 * Report-only pipeline
 */
export async function applyReportOnly(
  context: AppContext,
  payload: ContentPayload,
  violation: {
    type: ViolationType;
    reason: string;
    confidence: number;
  }
): Promise<void> {

  const reason =
    `[DesiMod AI] ${violation.type} ` +
    `(Conf: ${(violation.confidence * 100).toFixed(0)}%)`;

  try {

    const thing =
      payload.kind === "comment"
        ? await context.reddit.getCommentById(payload.id as `t1_${string}`)
        : await context.reddit.getPostById(payload.id as `t3_${string}`);

    await context.reddit.report(thing, {
      reason,
    });

    logger.info(
      {
        author: payload.author,
        type: violation.type,
        action: "report",
      },
      "Content reported"
    );

  } catch (err: any) {

    logger.warn(
      { err: err?.message },
      "Report action failed"
    );

  }
}
