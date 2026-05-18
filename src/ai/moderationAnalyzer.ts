/**
 * moderationAnalyzer.ts — runs single unified classifier against content.
 */
import type { RedisClient } from "@devvit/public-api";
import { askGemini } from "./geminiClient.js";
import { buildCombinedPrompt } from "../prompts/combinedModerationPrompt.js";
import type { ViolationResult } from "../moderation/types.js";

export type DecisionLevel = "SAFE" | "LOW" | "MEDIUM" | "HIGH";

export interface AnalyzerOutput {
  severityScore: number;
  decisionLevel: DecisionLevel;
  violations: ViolationResult[];
}

export async function analyzeContent(
  text: string,
  apiKey: string,
  redis?: RedisClient,
  subredditName?: string
): Promise<AnalyzerOutput> {
  const result = await askGemini(buildCombinedPrompt(text), apiKey, redis, 3, subredditName);

  const severityScore =
    (result.isToxic ? 1 : 0) +
    (result.isScam ? 1.2 : 0) +
    (result.isImplicit ? 0.3 : 0);

  let decisionLevel: DecisionLevel = "SAFE";
  if (severityScore >= 1.5) decisionLevel = "HIGH";
  else if (severityScore >= 1.0) decisionLevel = "MEDIUM";
  else if (severityScore >= 0.5) decisionLevel = "LOW";
  else decisionLevel = "SAFE";

  const isFlagged = decisionLevel !== "SAFE";
  
  // Terminal logging for developer visibility
  console.log(`[GEMINI] Eval: "${text.slice(0, 50)}${text.length > 50 ? "..." : ""}"`);
  console.log(`[GEMINI] Result: ${isFlagged ? "🚨 FLAGGED" : "✅ SAFE"} (Severity: ${severityScore.toFixed(2)})`);
  if (isFlagged) {
    console.log(`[GEMINI] Reason: ${result.reason}`);
  }

  const violations: ViolationResult[] = [];
  const isImplicit = result.isImplicit || false;

  if (result.isToxic) {
    violations.push({
      type: "toxicity",
      confidence: result.confidence,
      reason: result.reason,
      isImplicit,
    });
  }

  if (result.isScam) {
    violations.push({
      type: "scam",
      confidence: result.confidence,
      reason: result.reason,
      isImplicit,
    });
  }

  return { severityScore, decisionLevel, violations };
}

