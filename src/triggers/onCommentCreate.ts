import { TriggerContext } from "@devvit/public-api";
import { processModeration } from "../moderation/moderationService.js";

export async function handleCommentCreate(event: any, context: TriggerContext) {
  try {
    const comment = event.comment;
    if (!comment?.body || !comment?.authorName) return;

    await processModeration(context, {
      id: comment.id,
      author: comment.authorName,
      body: comment.body,
      kind: 'comment'
    });
  } catch (err) {
    console.error("Comment trigger error:", err);
  }
}