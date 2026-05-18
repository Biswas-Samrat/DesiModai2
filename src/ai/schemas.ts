import { z } from "zod";

export const aiModerationSchema = z.object({
  safe: z.boolean(),
  isToxic: z.boolean(),
  isScam: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  isImplicit: z.boolean()
});

export type AiModerationResponse = z.infer<typeof aiModerationSchema>;
