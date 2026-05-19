import { describe, expect, it } from "vitest";
import {
  buildModmailBody,
  buildModmailSubject,
} from "../moderation/modmailFormatter.js";

describe("modmail formatter", () => {
  it("includes user context, current violation, and history table", () => {
    const body = buildModmailBody({
      username: "Careful_Note_1202",
      subreddit: "swarna999",
      strikeCount: 3,
      current: {
        type: "scam",
        reason: "Promises free crypto earnings.",
        confidence: 0.98,
        kind: "post",
        permalink: "/r/swarna999/comments/abc/earn_crypto/",
      },
      history: [
        {
          strike: 1,
          type: "toxicity",
          reason: "Profanity and harassment.",
          confidence: 1,
          kind: "post",
          permalink: "/r/swarna999/comments/one/",
          contentId: "t3_one",
          at: "2026-05-20T10:00:00.000Z",
        },
        {
          strike: 2,
          type: "toxicity",
          reason: "Repeated insult.",
          confidence: 0.92,
          kind: "comment",
          permalink: "/r/swarna999/comments/two/",
          contentId: "t1_two",
          at: "2026-05-20T11:00:00.000Z",
        },
        {
          strike: 3,
          type: "scam",
          reason: "Promises free crypto earnings.",
          confidence: 0.98,
          kind: "post",
          permalink: "/r/swarna999/comments/abc/earn_crypto/",
          contentId: "t3_abc",
          at: "2026-05-20T12:00:00.000Z",
        },
      ],
    });

    expect(body).toContain("u/Careful_Note_1202");
    expect(body).toContain("r/swarna999");
    expect(body).toContain("Scam / spam");
    expect(body).toContain("Toxicity / harassment");
    expect(body).toContain("Violation history");
    expect(body).toContain("| 1 |");
    expect(body).toContain("| 3 |");
    expect(body).toContain("Promises free crypto");
  });

  it("builds a descriptive subject line", () => {
    expect(buildModmailSubject("test_user", "scam", 3)).toBe(
      "3-Strike: u/test_user — Scam / spam (3 strikes)"
    );
  });
});
