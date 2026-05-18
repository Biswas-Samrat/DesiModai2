import type { ModerationDecision } from "./types.js";

/**
 * HUMAN-IN-THE-LOOP TRIAGE LAYER
 * Handles implicit toxicity by lowering thresholds for manual review.
 */
export function getDecision(confidence: number, isImplicit: boolean = false): ModerationDecision {
  // If implicit (sarcasm/irony), lower the bar for human review (report) but keep high bar for auto-removal
  const removeThreshold = 0.90;
  const reportThreshold = isImplicit ? 0.6 : 0.7;

  if (confidence >= removeThreshold) return "remove";
  if (confidence >= reportThreshold) return "report";
  return "ignore";
}

