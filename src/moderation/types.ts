export type SupportedLanguage = "bangla" | "hindi" | "english" | "hinglish" | "banglish";

export type ContentKind = "post" | "comment";
export type ViolationType = "toxicity" | "scam";
export type Severity = "low" | "medium" | "high";

export type ModerationDecision = "ignore" | "report" | "remove";

export interface ContentPayload {
  id: string;
  author: string;
  subreddit: string;
  body: string;
  permalink: string;
  kind: ContentKind;
}

export interface ViolationResult {
  type: ViolationType;
  confidence: number;
  reason: string;
  severity: Severity;
}
