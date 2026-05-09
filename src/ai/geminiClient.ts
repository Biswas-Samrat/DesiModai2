import Bottleneck from "bottleneck";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { aiModerationSchema, type AiModerationResponse } from "./schemas.js";
import { getEnv } from "../utils/env.js";
import { logger } from "../utils/logger.js";

const limiter = new Bottleneck({
  minTime: 250,
  maxConcurrent: 2
});

const client = new GoogleGenerativeAI(getEnv().GEMINI_API_KEY);
const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function askGemini(prompt: string): Promise<AiModerationResponse> {
  const start = Date.now();
  try {
    const response = await limiter.schedule(async () => model.generateContent(prompt));
    const text = response.response.text();
    const parsed = aiModerationSchema.parse(extractJson(text));
    logger.info(
      {
        latencyMs: Date.now() - start,
        confidence: parsed.confidence,
        reason: parsed.reason
      },
      "Gemini moderation response"
    );
    return parsed;
  } catch (error) {
    logger.error({ error, latencyMs: Date.now() - start }, "Gemini request failed");
    throw error;
  }
}
