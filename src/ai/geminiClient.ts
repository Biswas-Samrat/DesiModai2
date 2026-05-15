/**
 * geminiClient.ts — calls Gemini API using the key from Devvit Settings.
 */

import { logger } from "../utils/logger.js";
import {
  aiModerationSchema,
  type AiModerationResponse,
} from "./schemas.js";

// Updated Gemini model
const GEMINI_MODEL = "gemini-2.0-flash";

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
  apiKey: string
): Promise<AiModerationResponse> {
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
    },
  };

  const start = Date.now();

  try {
    logger.info("Sending request to Gemini...");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();

      logger.error(
        {
          status: response.status,
          errorText,
        },
        "Gemini API request failed"
      );

      throw new Error(
        `Gemini HTTP ${response.status}: ${errorText}`
      );
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
      "Gemini moderation response"
    );

    return parsed;
  } catch (error) {
    logger.error(
      {
        error,
        latencyMs: Date.now() - start,
      },
      "Gemini request failed"
    );

    throw error;
  }
}