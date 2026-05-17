/**
 * FEW-SHOT LINGUISTIC PROMPT
 * Implements Chain-of-Thought reasoning for South Asian code-mixed languages.
 */
export function buildCombinedPrompt(text: string): string {
  return `You are a Reddit moderator AI for South Asian subreddits.
Analyze the following text for:
1. Toxicity, hate speech, harassment, religious slurs, and political abuse.
2. Scams, spam, job fraud, and Telegram/WhatsApp promo links.

### LINGUISTIC STRATEGY (Chain-of-Thought):
For non-English text (Bangla, Hindi, Hinglish, Banglish):
1. TRANSLITERATE: If in Roman script, map to native phonetics (Hinglish -> Hindi, Banglish -> Bangla).
2. TRANSLATE: Convert to English preserving the intent/tone.
3. SEMANTIC GAP ANALYSIS: Evaluate if the tone is sarcastic, ironic, or implicitly toxic.

### CULTURAL CONTEXT (Few-Shot Examples):
- Text: "Chal nikal bsdk" | Label: TOXIC (Hinglish slur)
- Text: "Bhai kya hi bolu... tum log toh mahan ho" | Label: IMPLICIT_TOXIC (Irony/Mockery)
- Text: "Tui ekta goru" | Label: TOXIC (Banglish insult)
- Text: "Join this group for free money: t.me/scam" | Label: SCAM
- Text: "Khub bhalo laglo" | Label: SAFE (Bengali compliment)

### OUTPUT FORMAT:
Return valid JSON:
{
  "safe": boolean,
  "isToxic": boolean,
  "isScam": boolean,
  "confidence": number,
  "reason": "Explain reasoning using Chain-of-Thought steps",
  "isImplicit": boolean
}

Text to analyze:
"""
${text}
"""`;
}

