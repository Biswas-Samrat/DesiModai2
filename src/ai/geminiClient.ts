/**
 * geminiClient.ts — calls Gemini API using the key from Devvit Settings.
 */

import { logger } from "../utils/logger.js";
import {
  aiModerationSchema,
  type AiModerationResponse,
} from "./schemas.js";

// Updated Gemini model
const GEMINI_MODEL = "gemini-3.1-flash-lite";

// Correct API base
const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

import type { RedisClient } from "@devvit/public-api";

function extractJson(raw: string): unknown {
  // Remove markdown code blocks if Gemini returns them
  const cleaned = raw.replace(/```json|```/gi, "").trim();

  // Find first JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);

  if (!match) {
    throw new Error(`No JSON found in Gemini response: ${raw}`);
  }

  return JSON.parse(match[0]);
}

/**
 * Call Gemini with moderation prompt
 */
export async function askGemini(
  prompt: string,
  apiKey: string,
  redis?: RedisClient,
  retries = 3
): Promise<AiModerationResponse> {
  // 1. Rate limiting / Cooldown so repeated bursts do not overwhelm Gemini
  if (redis) {
    try {
      const cooldownMs = 1000; // 1s cooldown between consecutive moderation requests
      const lastRequestKey = "gemini_last_request_time";
      const now = Date.now();
      const lastRequestTimeStr = await redis.get(lastRequestKey);
      if (lastRequestTimeStr) {
        const lastRequestTime = parseInt(lastRequestTimeStr, 10);
        const elapsed = now - lastRequestTime;
        if (elapsed < cooldownMs) {
          const delay = cooldownMs - elapsed;
          logger.info({ rateLimitDelay: delay }, `[RATE LIMIT] Cooldown active. Delaying for ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      await redis.set(lastRequestKey, String(Date.now()));
    } catch (err: any) {
      logger.warn({ err: err?.message }, "Failed to apply Gemini rate limit / cooldown via Redis, proceeding anyway.");
    }
  }

  const url =
    `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 512,
      responseMimeType: "application/json",
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  };

  let delayMs = 1000;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const start = Date.now();

    try {
      if (attempt > 1) {
        logger.info({ attempt }, `[RETRY] retry attempt number: ${attempt}`);
      }

      logger.info({ attempt }, "Gemini request sent");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini HTTP ${response.status}: ${errorText}`);
      }

      const json = (await response.json()) as {
        candidates?: {
          content?: {
            parts?: { text: string }[];
          };
        }[];
      };

      const text =
        json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      logger.info({ attempt }, "Gemini response received");
      logger.info({ rawResponse: text }, "Raw Gemini response");

      const parsed = aiModerationSchema.parse(
        extractJson(text)
      );

      logger.info(
        {
          latencyMs: Date.now() - start,
          confidence: parsed.confidence,
          reason: parsed.reason,
        },
        "Unified moderation response received"
      );

      return parsed;
    } catch (error: any) {
      logger.error(
        {
          error: error?.message,
          latencyMs: Date.now() - start,
          attempt
        },
        "Gemini request failed"
      );

      if (attempt < retries) {
        logger.info({ delayMs }, `Retrying Gemini request after backoff`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      } else {
        logger.warn({ fallbackUsed: true }, "fallback used: All Gemini retries failed. Returning safe fallback.");
        return {
          safe: true,
          isToxic: false,
          isScam: false,
          confidence: 0,
          reason: "Gemini failure fallback"
        };
      }
    }
  }

  // Fallback in case loop somehow exits
  logger.warn({ fallbackUsed: true }, "fallback used: Loop exited unexpectedly. Returning safe fallback.");
  return {
    safe: true,
    isToxic: false,
    isScam: false,
    confidence: 0,
    reason: "Gemini failure fallback"
  };
}