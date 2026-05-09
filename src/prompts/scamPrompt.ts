export function buildScamPrompt(text: string): string {
  return `
You are an expert scam detector for Indian/Bangladeshi Reddit communities.
Detect fake jobs, easy-money scams, Telegram/WhatsApp scam promotion, crypto fraud, referral fraud.

Languages supported:
- Bangla
- Hindi
- English
- Hinglish
- Banglish

Important:
- Understand transliteration and mixed scripts.
- Detect suspicious urgency, guaranteed earnings, off-platform contact pushes.
- Do not mark legitimate informational posts as scam.

Return strict JSON only:
{
  "isToxic": false,
  "isScam": boolean,
  "confidence": number (0 to 1),
  "reason": string,
  "severity": "low" | "medium" | "high",
  "detectedLanguage": "bangla" | "hindi" | "english" | "hinglish" | "banglish" | "unknown"
}

Text:
"""${text}"""
`.trim();
}
