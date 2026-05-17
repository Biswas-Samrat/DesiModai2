/**
 * onCommentCreate.ts — trigger handler for new comments.
 *
 * Devvit calls this as: handler(event: protos.CommentSubmit, context: TriggerContext)
 * Field reference:
 *   event.comment.id, event.comment.body, event.comment.author, event.comment.permalink
 *   event.subreddit.name
 *   event.author.name (the UserV2 object, may differ from comment.author string)
 */
import type { TriggerContext } from "@devvit/public-api";
import type { CommentSubmit } from "@devvit/protos";
import { processModeration } from "../moderation/moderationService.js";

import { logger } from "../utils/logger.js";

export async function handleCommentCreate(
  event: CommentSubmit,
  context: TriggerContext
): Promise<void> {
  try {
    const comment = event.comment;
    const authorName = event.author?.name || comment?.author;
    if (!comment?.id || !authorName) return;

    logger.info({ id: comment.id, author: authorName }, "[STAGE 1] Trigger fired: CommentSubmit");

    // Fetch the real entity from Reddit API to avoid payload sanitization bugs (like '[Removed by Reddit]')
    let liveComment = null;
    try {
      liveComment = await context.reddit.getCommentById(comment.id);
    } catch (e: any) {
      logger.warn({ id: comment.id, err: e?.message }, "Failed to fetch live comment entity");
    }

    const realBody = liveComment?.body ?? comment.body ?? "";

    // Skip AutoModerator and deleted content
    if (authorName.toLowerCase() === "automoderator" || comment.deleted) return;

    const subredditName = event.subreddit?.name ?? "DesiModTest_Samrat";
    const permalink = (liveComment?.permalink || comment.permalink) || `/r/${subredditName}/comments/${event.post?.id ?? ""}/_/${comment.id}/`;

    await processModeration(context, {
      id: comment.id,
      author: authorName,
      subreddit: subredditName,
      body: comment.body ?? "",
      liveBody: realBody,
      permalink,
      kind: "comment",
    });
  } catch (err) {
    console.error("Comment trigger error:", err);
  }
}