export function buildCombinedPrompt(text: string): string {
  return `You are a Reddit moderator AI for Indian and Bangladeshi subreddits.
Analyze the following text for:
1. Toxicity, hate speech, harassment, religious slurs, and political abuse.
2. Scams, spam, job fraud, and Telegram/WhatsApp promo links.

Languages supported: English, Bangla, Hindi, Hinglish, Banglish.

Return valid JSON exactly in this format:
{
  "safe": boolean,
  "isToxic": boolean,
  "isScam": boolean,
  "confidence": number,
  "reason": string
}

Text to analyze:
"""
${text}
"""`;
}
