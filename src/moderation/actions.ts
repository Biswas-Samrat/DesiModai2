import type { TriggerContext } from "@devvit/public-api";
import type { ContentPayload, ViolationResult } from "./types.js";
import { incrementStrike } from "../storage/strikeStore.js";
import { logEscalation, logRemoval, logWarning } from "../storage/analyticsStore.js";
import { logger } from "../utils/logger.js";

const WARNING_MESSAGE =
  "Your recent content appears to violate subreddit safety rules (toxicity/scam policy). Please avoid abusive language, hate speech, and scam promotion. Repeated violations may be escalated to subreddit moderators.";

export async function applyRemovalWithStrike(
  context: TriggerContext,
  payload: ContentPayload,
  violation: ViolationResult
): Promise<void> {
  if (payload.kind === "comment") {
    await context.reddit.remove(payload.id, false);
  } else {
    await context.reddit.remove(payload.id, false);
  }

  await logRemoval(violation.type);

  const strikeCount = await incrementStrike(payload.author);
  const modNote = `[AI-Mod] ${violation.type} (${violation.severity}) confidence=${violation.confidence.toFixed(
    2
  )} reason=${violation.reason} strike=${strikeCount}`;

  try {
    await context.reddit.addModNote({
      subreddit: payload.subreddit,
      user: payload.author,
      note: modNote,
    });
  } catch (error) {
    logger.warn({ error, username: payload.author }, "Failed to add mod note");
  }

  if (strikeCount <= 2) {
    await context.reddit.sendPrivateMessage({
      to: payload.author,
      subject: "Moderator warning",
      text: WARNING_MESSAGE,
    });
    await logWarning();
    return;
  }

  await context.reddit.modMail.createConversation({
    subredditName: payload.subreddit,
    subject: `[AI escalation] 3rd strike: u/${payload.author}`,
    body: `User reached 3 strikes.\n\nViolation: ${violation.type}\nReason: ${violation.reason}\nConfidence: ${violation.confidence.toFixed(
      2
    )}\nEvidence: https://reddit.com${payload.permalink}`,
  });

  await logEscalation(`https://reddit.com${payload.permalink}`, payload.author);
}

export async function applyReportOnly(
  context: TriggerContext,
  payload: ContentPayload,
  violation: ViolationResult
): Promise<void> {
  const reason = `[AI review] ${violation.type} confidence=${violation.confidence.toFixed(2)} ${
    violation.reason
  }`;

  if (payload.kind === "comment") {
    const comment = await context.reddit.getCommentById(payload.id);
    await context.reddit.report(comment, { reason });
  } else {
    const post = await context.reddit.getPostById(payload.id);
    await context.reddit.report(post, { reason });
  }
}
