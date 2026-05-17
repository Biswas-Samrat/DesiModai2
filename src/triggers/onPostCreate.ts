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

import { logger } from "../utils/logger.js";

export async function handlePostCreate(
  event: PostSubmit,
  context: TriggerContext
): Promise<void> {
  try {
    const post = event.post;
    const authorName = event.author?.name;
    if (!post?.id || !authorName) return;

    logger.info({ id: post.id, author: authorName }, "[STAGE 1] Trigger fired: PostSubmit");

    // Fetch the real entity from Reddit API to avoid payload sanitization bugs (like '[Removed by Reddit]')
    let livePost = null;
    try {
      livePost = await context.reddit.getPostById(post.id);
    } catch (e: any) {
      logger.warn({ id: post.id, err: e?.message }, "Failed to fetch live post entity");
    }

    const realBody = [
      livePost?.title ?? post.title ?? "",
      livePost?.body ?? post.selftext ?? ""
    ].join("\n").trim();

    const triggerBody = [
      post.title ?? "",
      post.selftext ?? ""
    ].join("\n").trim();

    // Skip AutoModerator and deleted content
    if (authorName.toLowerCase() === "automoderator" || post.deleted) return;

    const subredditName = event.subreddit?.name ?? "DesiModTest_Samrat";
    const permalink = (livePost?.permalink || post.permalink) || `/r/${subredditName}/comments/${post.id}/`;

    await processModeration(context, {
      id: post.id,
      author: authorName,
      subreddit: subredditName,
      body: triggerBody,
      liveBody: realBody,
      permalink,
      kind: "post",
    });
  } catch (err) {
    console.error("Post trigger error:", err);
  }
}