/**
 * textCleaner.ts — strips platform-specific placeholders and cleans content
 * for AI analysis.
 */

export function cleanContent(text: string): string {
  if (!text) return "";

  // Remove common Reddit system placeholders that can confuse the AI,
  // but do NOT strip URLs, as they are crucial for scam/spam detection.
  const redditPlaceholders = [
    /\[Removed by Reddit\]/gi,
    /\[deleted\]/gi,
    /\[removed\]/gi,
  ];

  let cleaned = text;
  for (const regex of redditPlaceholders) {
    cleaned = cleaned.replace(regex, "");
  }

  // Trim extra whitespace
  return cleaned.trim();
}
