/**
 * onPostCreate.ts — trigger handler for new posts.
 *
 * Devvit calls this as: handler(event: protos.PostSubmit, context: TriggerContext)
 * Field reference:
 *   event.post.id, event.post.title, event.post.selftext, event.post.permalink
 *   event.subreddit.name
 *   event.author.name (the UserV2 object)
 */
import type { TriggerContext } from "@devvit/public-api";
import type { PostSubmit } from "@devvit/protos";
import { processModeration } from "../moderation/moderationService.js";

export async function handlePostCreate(
  event: PostSubmit,
  context: TriggerContext
): Promise<void> {
  try {
    const post = event.post;
    if (!post?.title || !event.author?.name) return;

    // Skip AutoModerator and deleted content
    if (event.author.name === "AutoModerator" || post.deleted) return;

    const subredditName = event.subreddit?.name ?? "DesiModTest_Samrat";
    // Combine title and body for full-text analysis
    const body = [post.title, post.selftext ?? ""].filter(Boolean).join("\n").trim();
    const permalink = post.permalink || `/r/${subredditName}/comments/${post.id}/`;

    await processModeration(context, {
      id: post.id,
      author: event.author.name,
      subreddit: subredditName,
      body,
      permalink,
      kind: "post",
    });
  } catch (err) {
    console.error("Post trigger error:", err);
  }
}