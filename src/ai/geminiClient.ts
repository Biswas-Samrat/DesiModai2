/**
 * geminiClient.ts — calls Gemini API using the key from Devvit Settings.
 */

import { logger } from "../utils/logger.js";
import {
  aiModerationSchema,
  type AiModerationResponse,
} from "./schemas.js";
import type { RedisClient } from "../types/devvit.js";
import { REDIS_KEYS, REDIS_TTLS } from "../constants/redisKeys.js";

// Updated Gemini model
const GEMINI_MODEL = "gemini-3.1-flash-lite";

// Correct API base
const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

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
  retries = 3,
  subredditName?: string
): Promise<AiModerationResponse> {
  // 1. Rate limiting / Cooldown so repeated bursts do not overwhelm Gemini
  if (redis) {
    try {
      const cooldownMs = 1000; // 1s cooldown between consecutive moderation requests
      const lastRequestKey = REDIS_KEYS.geminiRateLimit(subredditName);
      
      if (!subredditName) {
         logger.warn({}, "Subreddit name not provided to Gemini rate limiter, falling back to global key.");
      }

      // Add request burst protection queue-like delay
      while (true) {
        const now = Date.now();
        const lastRequestTimeStr = await redis.get(lastRequestKey);
        if (lastRequestTimeStr) {
          const lastRequestTime = parseInt(lastRequestTimeStr, 10);
          const elapsed = now - lastRequestTime;
          if (elapsed < cooldownMs) {
            const delay = cooldownMs - elapsed;
            logger.info({ rateLimitDelay: delay }, `[RATE_LIMIT_QUEUE] waiting for slot`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue; // Recheck after waiting
          }
        }
        await redis.set(lastRequestKey, String(Date.now()), { expiration: new Date(Date.now() + REDIS_TTLS.geminiRateLimitMs) });
        break;
      }
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      logger.warn({ attempt }, "[GEMINI_TIMEOUT]");
      controller.abort();
    }, 15000); // 15 seconds AbortController timeout

    try {
      if (attempt > 1) {
        logger.info({ attempt, delayMs }, `[GEMINI_RETRYING] attempt number: ${attempt}`);
      }

      logger.info({ attempt }, "Gemini request sent");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ attempt, status: response.status }, "[GEMINI_FETCH_FAILED]");
        throw new Error(`Gemini HTTP ${response.status}: ${errorText}`);
      }

      const json = (await response.json()) as {
        candidates?: {
          content?: {
            parts?: { text: string }[];
          };
        }[];
      };

      if (!json.candidates || json.candidates.length === 0) {
        logger.warn({ attempt }, "[GEMINI_EMPTY_RESPONSE] candidates list is empty or missing");
        throw new Error("Empty candidates in Gemini response");
      }

      const text =
        json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      if (!text) {
        logger.warn({ attempt }, "[GEMINI_EMPTY_RESPONSE] first candidate content text is empty");
        throw new Error("Empty text in Gemini response candidate");
      }

      logger.info({ attempt }, "Gemini response received");
      logger.info({ rawResponse: text }, "Raw Gemini response");

      let extracted;
      try {
        extracted = extractJson(text);
      } catch (err: any) {
        logger.error({ attempt, error: err?.message, text }, "Invalid JSON extraction from Gemini response");
        throw err;
      }

      const parsed = aiModerationSchema.parse(extracted);

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
      clearTimeout(timeoutId);

      const isTimeout = error.name === "AbortError";
      if (isTimeout) {
        logger.error({ attempt, latencyMs: Date.now() - start }, "Gemini request timed out");
      } else {
        logger.error(
          {
            error: error?.message,
            latencyMs: Date.now() - start,
            attempt
          },
          "Gemini request failed"
        );
      }

      // Retry ONLY on transient failures (timeouts, aborts, fetch fails, HTTP 5xx, or empty/malformed responses)
      const isTransient = isTimeout || (error.message && (
        error.message.includes("HTTP 5") || 
        error.message.includes("fetch failed") || 
        error.message.includes("Empty candidates") || 
        error.message.includes("Empty text")
      ));

      if (attempt < retries && isTransient) {
        logger.info({ delayMs }, `Retrying Gemini request after backoff`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      } else {
        logger.warn({ fallbackUsed: true }, "[AI_FAILSAFE_SAFE_MODE]");
        return {
          safe: true,
          isToxic: false,
          isScam: false,
          confidence: 0,
          reason: "Gemini failure fallback",
          isImplicit: false
        };
      }
    }
  }

  // Fallback in case loop somehow exits
  logger.warn({ fallbackUsed: true }, "[AI_FAILSAFE_SAFE_MODE]");
  return {
    safe: true,
    isToxic: false,
    isScam: false,
    confidence: 0,
    reason: "Gemini failure fallback",
    isImplicit: false
  };
}
