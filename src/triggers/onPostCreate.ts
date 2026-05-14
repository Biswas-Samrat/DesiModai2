import { TriggerContext } from "@devvit/public-api";
import { processModeration } from "../moderation/moderationService.js";

export async function handlePostCreate(event: any, context: TriggerContext) {
  try {
    const post = event.post;
    if (!post?.title || !post?.authorName) return;

    const body = `${post.title}\n${post.selftext ?? ""}`.trim();

    await processModeration(context, {
      id: post.id,
      author: post.authorName,
      body: body,
      kind: 'post'
    });
  } catch (err) {
    console.error("Post trigger error:", err);
  }
}