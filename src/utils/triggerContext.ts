import type { AppContext } from "../types/devvit.js";

type TriggerEvent = {
  subreddit?: { id?: string; name?: string };
};

/** Merge trigger payload subreddit fields when server `context` omits them. */
export function enrichContextFromTrigger(
  context: AppContext,
  event: TriggerEvent
): AppContext {
  const subredditId =
    context.subredditId ??
    (event.subreddit?.id as AppContext["subredditId"] | undefined);

  return {
    ...context,
    subredditId,
    subredditName:
      context.subredditName ??
      (event.subreddit?.name as AppContext["subredditName"] | undefined),
  };
}
