/**
 * moderationAnalyzer.ts — runs both toxicity and scam classifiers against content.
 *
 * apiKey is passed from the trigger handler via context.settings.get("gemini_api_key").
 */
import { askGemini } from "./geminiClient.js";
import { buildScamPrompt } from "../prompts/scamPrompt.js";
import { buildToxicityPrompt } from "../prompts/toxicityPrompt.js";
import type { ViolationResult } from "../moderation/types.js";

export async function analyzeContent(
  text: string,
  apiKey: string
): Promise<ViolationResult[]> {
  const [toxicity, scam] = await Promise.all([
    askGemini(buildToxicityPrompt(text), apiKey),
    askGemini(buildScamPrompt(text), apiKey),
  ]);

  const results: ViolationResult[] = [];

  if (toxicity.isToxic) {
    results.push({
      type: "toxicity",
      confidence: toxicity.confidence,
      reason: toxicity.reason,
      severity: toxicity.severity,
    });
  }

  if (scam.isScam) {
    results.push({
      type: "scam",
      confidence: scam.confidence,
      reason: scam.reason,
      severity: scam.severity,
    });
  }

  return results;
}
