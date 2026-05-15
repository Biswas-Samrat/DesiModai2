import { describe, expect, it, vi } from "vitest";
import { handleCommentCreate } from "../triggers/onCommentCreate.js";
import * as moderationService from "../moderation/moderationService.js";

describe("comment trigger integration", () => {
  it("builds payload and calls moderation service", async () => {
    const processSpy = vi
      .spyOn(moderationService, "processModeration")
      .mockResolvedValueOnce(undefined);

    // Use the correct proto field names: author (not authorName), subreddit.name (not subredditName)
    const event = {
      comment: {
        id: "t1_x",
        body: "tum chutiya ho",
        author: "bad_actor",
        permalink: "/r/desi_sub/comments/x",
        deleted: false,
        parentId: "",
        numReports: 0,
        collapsedBecauseCrowdControl: false,
        spam: false,
        createdAt: 0,
        upvotes: 0,
        downvotes: 0,
        languageCode: "en",
        lastModifiedAt: 0,
        gilded: false,
        score: 0,
        hasMedia: false,
        postId: "t3_abc",
        subredditId: "t5_def",
        elementTypes: [],
        mediaUrls: [],
      },
      subreddit: { name: "desi_sub", id: "t5_def", nsfw: false, spam: false, quarantined: false, topics: [], permalink: "", title: "", description: "", subscribersCount: 0, type: 5, rating: 0 },
      post: { id: "t3_abc" },
      author: { name: "bad_actor", id: "t2_xyz", isGold: false, snoovatarImage: "", url: "", spam: false, banned: false, karma: 0, iconImage: "", description: "", suspended: false },
    };

    await handleCommentCreate(event as never, {} as never);
    expect(processSpy).toHaveBeenCalledTimes(1);
  });
});
