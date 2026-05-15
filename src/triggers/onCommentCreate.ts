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

export async function handleCommentCreate(
  event: CommentSubmit,
  context: TriggerContext
): Promise<void> {
  try {
    const comment = event.comment;
    if (!comment?.body || !comment?.author) return;

    // Skip AutoModerator and deleted content
    if (comment.author === "AutoModerator" || comment.deleted) return;

    const subredditName = event.subreddit?.name ?? "DesiModTest_Samrat";
    const permalink = comment.permalink || `/r/${subredditName}/comments/${event.post?.id ?? ""}/_/${comment.id}/`;

    await processModeration(context, {
      id: comment.id,
      author: comment.author,
      subreddit: subredditName,
      body: comment.body,
      permalink,
      kind: "comment",
    });
  } catch (err) {
    console.error("Comment trigger error:", err);
  }
}