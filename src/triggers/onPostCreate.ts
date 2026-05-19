/**
 * onPostCreate.ts — trigger handler for new posts.
 *
 * Devvit calls this as a post submit trigger endpoint.
 * Field reference:
 *   event.post.id, event.post.title, event.post.selftext, event.post.permalink
 *   event.subreddit.name
 *   event.author.name (the UserV2 object)
 */
import type { AppContext } from "../types/devvit.js";
import { processModeration } from "../moderation/moderationService.js";

import { logger } from "../utils/logger.js";

export async function handlePostCreate(
  event: any,
  context: AppContext
): Promise<void> {
  try {
    const post = event.post;
    let initialAuthorName = event.author?.name || "";
    if (!post?.id) return;

    logger.info({ id: post.id, author: initialAuthorName }, "trigger fired");

    // Fetch the real entity from Reddit API to avoid payload sanitization bugs (like '[Removed by Reddit]')
    let livePost = null;
    try {
      livePost = await context.reddit.getPostById(post.id);
      if (livePost) {
        logger.info({ id: post.id }, "live entity fetched");
      }
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

    const realAuthorName = livePost?.authorName || initialAuthorName;

    // Skip if already deleted or removed
    if (post.deleted) {
      logger.info({ id: post.id }, "Post already deleted — skipping moderation");
      return;
    }

    const subredditName = event.subreddit?.name ?? "DesiModTest_Samrat";
    const permalink = (livePost?.permalink || post.permalink) || `/r/${subredditName}/comments/${post.id}/`;

    await processModeration(context, {
      id: post.id,
      author: realAuthorName,
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
