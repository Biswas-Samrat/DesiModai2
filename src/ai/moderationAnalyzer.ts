/**
 * moderationAnalyzer.ts — runs single unified classifier against content.
 */
import { askGemini } from "./geminiClient.js";
import { buildCombinedPrompt } from "../prompts/combinedModerationPrompt.js";
import type { ViolationResult } from "../moderation/types.js";

export async function analyzeContent(
  text: string,
  apiKey: string
): Promise<ViolationResult[]> {
  const result = await askGemini(buildCombinedPrompt(text), apiKey);

  const results: ViolationResult[] = [];

  if (result.isToxic) {
    results.push({
      type: "toxicity",
      confidence: result.confidence,
      reason: result.reason,
    });
  }

  if (result.isScam) {
    results.push({
      type: "scam",
      confidence: result.confidence,
      reason: result.reason,
    });
  }

  return results;
}
