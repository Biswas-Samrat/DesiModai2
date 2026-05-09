import type { TriggerContext } from "@devvit/public-api";
import { processModeration } from "../moderation/moderationService.js";
import type { ContentPayload } from "../moderation/types.js";

interface CommentCreateEvent {
  comment?: {
    id: string;
    body: string;
    authorName: string;
    subredditName: string;
    permalink: string;
  };
}

export async function handleCommentCreate(
  event: CommentCreateEvent,
  context: TriggerContext
): Promise<void> {
  if (!event.comment?.body || !event.comment.authorName) return;

  const payload: ContentPayload = {
    id: event.comment.id,
    author: event.comment.authorName,
    subreddit: event.comment.subredditName,
    body: event.comment.body,
    permalink: event.comment.permalink,
    kind: "comment"
  };

  await processModeration(context, payload);
}
