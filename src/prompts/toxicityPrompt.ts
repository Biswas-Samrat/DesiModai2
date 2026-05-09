export function buildToxicityPrompt(text: string): string {
  return `
You are an expert South Asian moderation classifier for Reddit.
Analyze the following text for toxicity, hate speech, political abuse, religious slurs, harassment.

Languages supported:
- Bangla
- Hindi
- English
- Hinglish (Hindi in Latin script)
- Banglish (Bangla in Latin script)

Important:
- Understand transliterated and code-mixed language.
- Distinguish contextual safe usage from direct abuse.
- "রাজাকার documentary" or historical/political discussion can be safe if not abusive.
- Focus on intent and target harassment.

Return strict JSON only:
{
  "isToxic": boolean,
  "isScam": false,
  "confidence": number (0 to 1),
  "reason": string,
  "severity": "low" | "medium" | "high",
  "detectedLanguage": "bangla" | "hindi" | "english" | "hinglish" | "banglish" | "unknown"
}

Text:
"""${text}"""
`.trim();
}
