import type { ViolationRecord } from "../storage/violationHistoryStore.js";
import type { ContentKind, ViolationType } from "./types.js";

export type ModmailViolation = {
  type: ViolationType;
  reason: string;
  confidence: number;
};

function violationLabel(type: ViolationType): string {
  switch (type) {
    case "toxicity":
      return "Toxicity / harassment";
    case "scam":
      return "Scam / spam";
    default:
      return "Policy violation";
  }
}

function contentLabel(kind: ContentKind): string {
  return kind === "comment" ? "Comment" : "Post";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toUTCString();
  } catch {
    return iso;
  }
}

function permalinkUrl(permalink: string): string {
  return permalink.startsWith("http")
    ? permalink
    : `https://reddit.com${permalink}`;
}

/**
 * Builds markdown for strike-3 modmail with current violation + full history.
 */
export function buildModmailBody(options: {
  username: string;
  subreddit: string;
  strikeCount: number;
  current: ModmailViolation & { kind: ContentKind; permalink: string };
  history: ViolationRecord[];
}): string {
  const { username, subreddit, strikeCount, current, history } = options;
  const currentUrl = permalinkUrl(current.permalink);

  const lines: string[] = [
    `## 3-Strike escalation — u/${username}`,
    "",
    `**User:** u/${username}`,
    `**Subreddit:** r/${subreddit}`,
    `**Total strikes:** ${strikeCount}`,
    "",
    "---",
    "",
    `### Current violation (strike ${strikeCount})`,
    "",
    `| Field | Detail |`,
    `| --- | --- |`,
    `| Type | ${violationLabel(current.type)} |`,
    `| Content | ${contentLabel(current.kind)} |`,
    `| Confidence | ${(current.confidence * 100).toFixed(0)}% |`,
    `| AI reason | ${current.reason} |`,
    `| Link | ${currentUrl} |`,
    "",
  ];

  const orderedHistory =
    history.length > 0
      ? [...history].sort((a, b) => a.strike - b.strike)
      : [
          {
            strike: strikeCount,
            type: current.type,
            reason: current.reason,
            confidence: current.confidence,
            kind: current.kind,
            permalink: current.permalink,
            contentId: "",
            at: new Date().toISOString(),
          },
        ];

  lines.push("### Violation history (all recorded strikes)", "");
  lines.push(
    "| Strike | Type | Content | Confidence | When (UTC) | Link |",
    "| ---: | --- | --- | ---: | --- | --- |"
  );

  for (const row of orderedHistory) {
    lines.push(
      `| ${row.strike} | ${violationLabel(row.type)} | ${contentLabel(row.kind)} | ${(row.confidence * 100).toFixed(0)}% | ${formatDate(row.at)} | ${permalinkUrl(row.permalink)} |`
    );
  }

  lines.push(
    "",
    "**Summary for moderators**",
    "",
    `- **Toxicity removals in history:** ${orderedHistory.filter((r) => r.type === "toxicity").length}`,
    `- **Scam removals in history:** ${orderedHistory.filter((r) => r.type === "scam").length}`,
    "",
    "---",
    "",
    "*No auto-ban was issued. Please review the user and decide on further action (warn, temp ban, or permanent ban).*"
  );

  return lines.join("\n");
}

export function buildModmailSubject(
  username: string,
  violationType: ViolationType,
  strikeCount: number
): string {
  return `3-Strike: u/${username} — ${violationLabel(violationType)} (${strikeCount} strikes)`;
}
