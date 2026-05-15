import { describe, expect, it, vi } from "vitest";
import { analyzeContent } from "../ai/moderationAnalyzer.js";
import * as geminiModule from "../ai/geminiClient.js";

describe("moderationAnalyzer", () => {
  it("maps toxic + scam responses into violation results", async () => {
    const spy = vi.spyOn(geminiModule, "askGemini");

    spy
      .mockResolvedValueOnce({
        isToxic: true,
        isScam: false,
        confidence: 0.95,
        reason: "Bangla hate speech",
        severity: "high",
        detectedLanguage: "bangla"
      })
      .mockResolvedValueOnce({
        isToxic: false,
        isScam: true,
        confidence: 0.92,
        reason: "Telegram fraud",
        severity: "high",
        detectedLanguage: "banglish"
      });

    // analyzeContent now requires (text, apiKey)
    const results = await analyzeContent("test", "fake-api-key");
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe("toxicity");
    expect(results[1].type).toBe("scam");
  });
});
