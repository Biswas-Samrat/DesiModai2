import type { ModerationDecision } from "./types.js";

export function getDecision(confidence: number): ModerationDecision {
  if (confidence >= 0.9) return "remove";
  if (confidence >= 0.7) return "report";
  return "ignore";
}
