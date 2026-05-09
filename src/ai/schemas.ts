import { z } from "zod";

export const aiModerationSchema = z.object({
  isToxic: z.boolean(),
  isScam: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  detectedLanguage: z.enum(["bangla", "hindi", "english", "hinglish", "banglish", "unknown"])
});

export type AiModerationResponse = z.infer<typeof aiModerationSchema>;
