export type SupportedLanguage = "bangla" | "hindi" | "english" | "hinglish" | "banglish";

export type ContentKind = "post" | "comment";
export type ViolationType = "toxicity" | "scam";

export type ModerationDecision = "ignore" | "report" | "remove";

export interface ContentPayload {
  id: string;
  author: string;
  subreddit: string;
  body: string;
  liveBody?: string;
  permalink: string;
  kind: ContentKind;
}

export interface ViolationResult {
  type: ViolationType;
  confidence: number;
  reason: string;
  isImplicit?: boolean;
}

