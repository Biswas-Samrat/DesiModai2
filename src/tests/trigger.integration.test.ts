import { describe, expect, it, vi } from "vitest";
import { handleCommentCreate } from "../triggers/onCommentCreate.js";
import * as moderationService from "../moderation/moderationService.js";

describe("comment trigger integration", () => {
  it("builds payload and calls moderation service", async () => {
    const processSpy = vi
      .spyOn(moderationService, "processModeration")
      .mockResolvedValueOnce(undefined);

    const event = {
      comment: {
        id: "t1_x",
        body: "tum chutiya ho",
        authorName: "bad_actor",
        subredditName: "desi_sub",
        permalink: "/r/desi_sub/comments/x"
      }
    };

    await handleCommentCreate(event, {} as never);
    expect(processSpy).toHaveBeenCalledTimes(1);
  });
});
