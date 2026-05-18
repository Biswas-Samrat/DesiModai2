/**
 * moderationAnalyzer.ts — runs single unified classifier against content.
 */
import type { RedisClient } from "@devvit/public-api";
import { askGemini } from "./geminiClient.js";
import { buildCombinedPrompt } from "../prompts/combinedModerationPrompt.js";
import type { ViolationResult } from "../moderation/types.js";

export async function analyzeContent(
  text: string,
  apiKey: string,
  redis?: RedisClient
): Promise<ViolationResult[]> {
  const result = await askGemini(buildCombinedPrompt(text), apiKey, redis);

  const isFlagged = result.isToxic || result.isScam;
  
  // Terminal logging for developer visibility
  console.log(`[GEMINI] Eval: "${text.slice(0, 50)}${text.length > 50 ? "..." : ""}"`);
  console.log(`[GEMINI] Result: ${isFlagged ? "🚨 FLAGGED" : "✅ SAFE"} (Conf: ${(result.confidence * 100).toFixed(0)}%)`);
  if (isFlagged) {
    console.log(`[GEMINI] Reason: ${result.reason}`);
  }

  const results: ViolationResult[] = [];
  const isImplicit = (result as any).isImplicit || false;

  if (result.isToxic) {
    results.push({
      type: "toxicity",
      confidence: result.confidence,
      reason: result.reason,
      isImplicit,
    });
  }

  if (result.isScam) {
    results.push({
      type: "scam",
      confidence: result.confidence,
      reason: result.reason,
      isImplicit,
    });
  }

  return results;
}


