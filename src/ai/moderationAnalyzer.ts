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

  const isFlagged = result.isToxic || result.isScam;
  
  console.log("==========================================");
  console.log(`[TERMINAL FETCH] Content Evaluated: "${text}"`);
  console.log(`[TERMINAL FETCH] Flagged by Gemini: ${isFlagged ? "🚨 TOXIC" : "✅ SAFE"}`);
  console.log(`[TERMINAL FETCH] Reason Given: ${result.reason || "N/A"}`);
  console.log("==========================================");

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
