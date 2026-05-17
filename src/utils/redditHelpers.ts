import { RedditAPIClient } from "@devvit/public-api";

/**
 * Validates a Reddit username to avoid USER_DOESNT_EXIST errors,
 * especially during playtest where usernames may be deleted or missing.
 * Note: We do NOT check for "[redacted]" or "redacted" in this function,
 * so we do not block valid users who happen to have "redacted" in their name
 * or when the logging system redacts usernames.
 */
export function isValidRedditUsername(username: string | undefined): boolean {
  if (!username) return false;
  const lower = username.toLowerCase().trim();
  
  // Filter out truly missing, deleted, or AutoModerator accounts.
  if (
    lower === "" ||
    lower === "[deleted]" ||
    lower === "deleted" ||
    lower === "automoderator"
  ) {
    return false;
  }
  return true;
}

/**
 * Helper to get a redacted display name of a username for safe logs,
 * distinguishing it from the actual runtime username.
 */
export function redactUsername(username: string | undefined): string {
  if (!username) return "[unknown]";
  if (username.length <= 3) return "***";
  return `${username[0]}***${username[username.length - 1]}`;
}

/**
 * Truncates a string to the specified length.
 */
export function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit - 3) + "...";
}

/**
 * Safely adds a mod note, handling long notes and missing users.
 */
export async function safeAddModNote(
  reddit: RedditAPIClient,
  options: {
    subreddit: string;
    user: string;
    note: string;
    redditId?: string;
  }
): Promise<void> {
  // Pre-validation to avoid API errors
  if (!isValidRedditUsername(options.user)) {
    console.log(`[WARN] Skipping mod note: Username '${redactUsername(options.user)}' is truly invalid or missing.`);
    return;
  }

  try {
    // Truncate note to 250 chars per Reddit API limits
    const safeNote = truncate(options.note, 250);

    await reddit.addModNote({
      subreddit: options.subreddit,
      user: options.user,
      note: safeNote,
      redditId: options.redditId as any,
    });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    if (errorMsg.includes("USER_DOESNT_EXIST")) {
      console.log(`[WARN] Skipping ModNote: User u/${redactUsername(options.user)} does not exist at runtime.`);
    } else {
      console.log(`[ERROR] Failed to add ModNote for u/${redactUsername(options.user)}: ${errorMsg}`);
      throw err;
    }
  }
}

/**
 * Safely sends a private message, handling missing users.
 */
export async function safeSendPM(
  reddit: RedditAPIClient,
  options: {
    to: string;
    subject: string;
    text: string;
  }
): Promise<void> {
  if (!isValidRedditUsername(options.to)) {
    console.log(`[WARN] Skipping DM: Recipient '${redactUsername(options.to)}' is truly invalid or missing.`);
    return;
  }

  try {
    await reddit.sendPrivateMessage(options);
    console.log(`[INFO] DM sent successfully to user ${options.to}`);
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.log(`[ERROR] DM failed to send to user ${options.to}: ${errorMsg}`);
    throw err;
  }
}

/**
 * Safely sends a modmail via createModInboxConversation.
 */
export async function safeSendModmail(
  reddit: RedditAPIClient,
  options: {
    subredditId: string;
    subject: string;
    body: string;
  }
): Promise<void> {
  try {
    await reddit.modMail.createModInboxConversation({
      subredditId: options.subredditId,
      subject: options.subject,
      bodyMarkdown: options.body,
    });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.log(`[ERROR] Failed to send modmail to subreddit ${options.subredditId}: ${errorMsg}`);
    throw err;
  }
}
