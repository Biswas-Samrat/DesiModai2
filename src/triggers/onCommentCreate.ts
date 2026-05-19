/**
 * onCommentCreate.ts — trigger handler for new comments.
 *
 * Devvit calls this as a comment submit trigger endpoint.
 * Field reference:
 *   event.comment.id, event.comment.body, event.comment.author, event.comment.permalink
 *   event.subreddit.name
 *   event.author.name (the UserV2 object, may differ from comment.author string)
 */
import type { AppContext } from "../types/devvit.js";
import { processModeration } from "../moderation/moderationService.js";

import { logger } from "../utils/logger.js";

export async function handleCommentCreate(
  event: any,
  context: AppContext
): Promise<void> {
  try {
    const comment = event.comment;
    let initialAuthorName = event.author?.name || comment?.author || "";
    if (!comment?.id) return;

    logger.info({ id: comment.id, author: initialAuthorName }, "trigger fired");

    // Fetch the real entity from Reddit API to avoid payload sanitization bugs (like '[Removed by Reddit]')
    let liveComment = null;
    try {
      liveComment = await context.reddit.getCommentById(comment.id);
      if (liveComment) {
        logger.info({ id: comment.id }, "live entity fetched");
      }
    } catch (e: any) {
      logger.warn({ id: comment.id, err: e?.message }, "Failed to fetch live comment entity");
    }

    const realBody = liveComment?.body ?? comment.body ?? "";
    const realAuthorName = liveComment?.authorName || initialAuthorName;

    // Skip if already deleted or removed
    if (comment.deleted) {
      logger.info({ id: comment.id }, "Comment already deleted — skipping moderation");
      return;
    }

    const subredditName = event.subreddit?.name ?? "DesiModTest_Samrat";
    const permalink = (liveComment?.permalink || comment.permalink) || `/r/${subredditName}/comments/${event.post?.id ?? ""}/_/${comment.id}/`;

    await processModeration(context, {
      id: comment.id,
      author: realAuthorName,
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
