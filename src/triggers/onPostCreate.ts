import type { TriggerContext } from "@devvit/public-api";
import { processModeration } from "../moderation/moderationService.js";
import type { ContentPayload } from "../moderation/types.js";

interface PostCreateEvent {
  post?: {
    id: string;
    title: string;
    selftext?: string;
    authorName: string;
    subredditName: string;
    permalink: string;
  };
}

export async function handlePostCreate(
  event: PostCreateEvent,
  context: TriggerContext
): Promise<void> {
  if (!event.post?.authorName) return;

  const body = [event.post.title, event.post.selftext ?? ""].join("\n").trim();
  if (!body) return;

  const payload: ContentPayload = {
    id: event.post.id,
    author: event.post.authorName,
    subreddit: event.post.subredditName,
    body,
    permalink: event.post.permalink,
    kind: "post"
  };

  await processModeration(context, payload);
}
