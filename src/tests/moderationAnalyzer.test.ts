import { describe, expect, it, vi } from "vitest";
import { analyzeContent } from "../ai/moderationAnalyzer.js";
import * as geminiModule from "../ai/geminiClient.js";

describe("moderationAnalyzer", () => {
  it("maps toxic + scam responses into violation results", async () => {
    const spy = vi.spyOn(geminiModule, "askGemini");

    spy.mockResolvedValueOnce({
      safe: false,
      isToxic: true,
      isScam: true,
      confidence: 0.95,
      reason: "Toxic and contains scam",
    });

    const results = await analyzeContent("test", "fake-api-key");
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe("toxicity");
    expect(results[1].type).toBe("scam");
  });
});
