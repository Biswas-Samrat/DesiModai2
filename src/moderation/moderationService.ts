import { TriggerContext } from "@devvit/public-api";

export interface ModerationResult {
  toxic: boolean;
  scam: boolean;
  reason: string;
}

/**
 * Lazy-loaded AI function to avoid top-level heavy imports.
 */
async function runAI(text: string, apiKey: string): Promise<ModerationResult> {
  try {
    // Dynamic import to avoid bootstrap crash
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `
      You are a Reddit moderator for Indian and Bangladeshi subreddits.
      Detect toxicity and scams in: English, Bangla, Hindi, Banglish, Hinglish.
      
      Toxicity includes: slurs, hate speech, harassment. 
      IMPORTANT: Consider context. "রাজাকার" alone is toxic, but "রাজাকার documentary" is not.
      
      Scams include: easy money, Telegram/WhatsApp fraud, phishing links, "ঘরে বসে টাকা আয় করুন", "earn $500 daily".
      
      Output ONLY a JSON object: {"toxic": boolean, "scam": boolean, "reason": string}
    `;

    const result = await model.generateContent([systemPrompt, text]);
    const responseText = result.response.text();
    
    // Simple JSON extraction
    const jsonMatch = responseText.match(/\{.*\}/s);
    if (!jsonMatch) throw new Error("Invalid AI response");
    
    return JSON.parse(jsonMatch[0]) as ModerationResult;
  } catch (error) {
    console.error("AI execution failed:", error);
    return { toxic: false, scam: false, reason: "AI error" };
  }
}

/**
 * Main moderation logic.
 */
export async function processModeration(
  context: TriggerContext,
  payload: { id: string; author: string; body: string; kind: 'post' | 'comment' }
) {
  const { id, author, body, kind } = payload;

  // 1. Get API Key from settings
  const apiKey = await context.settings.get("gemini_api_key") as string;
  if (!apiKey) {
    console.warn("Gemini API key missing. Skipping AI moderation.");
    return;
  }

  // 2. Run AI
  const result = await runAI(body, apiKey);
  
  if (!result.toxic && !result.scam) return;

  console.log(`Moderation hit on ${kind} ${id} by ${author}: ${result.reason}`);

  // 3. Increment Strike System (Redis)
  const strikeKey = `user:${author}:strikes`;
  const strikes = await context.redis.incrBy(strikeKey, 1);

  // 4. Record Analytics for Dashboard
  const analyticsKey = `stats:removals:${result.scam ? 'scam' : 'toxic'}`;
  await context.redis.incrBy(analyticsKey, 1);
  await context.redis.incrBy("stats:warnings", 1);

  // 5. Take Actions based on Strike Level
  const reason = `[DesiMod AI] ${result.toxic ? 'Toxic' : 'Scam'} detected. Reason: ${result.reason}`;

  try {
    // A. Delete content
    await context.reddit.remove(id, false);

    // B. Add Mod Note
    await context.reddit.addModNote({
      subreddit: (await context.reddit.getCurrentSubreddit()).name,
      user: author,
      note: `${reason} (Strike ${strikes})`,
      redditId: id as any,
    });

    // C. DM User
    const dmSubject = "Moderation Warning: Strike " + strikes;
    const dmBody = `Hello u/${author}, your ${kind} was removed for violating community rules regarding ${result.toxic ? 'toxic content' : 'scams'}.\n\nReason: ${result.reason}\n\nThis is strike ${strikes}. Repeated violations may result in a ban.`;
    
    await context.reddit.sendPrivateMessage({
      to: author,
      subject: dmSubject,
      text: dmBody,
    });

    // D. Strike 3 Escalation
    if (strikes >= 3) {
      const subreddit = await context.reddit.getCurrentSubreddit();
      await context.reddit.sendPrivateMessage({
        to: subreddit.name, // Modmail target
        subject: "User Escalation: 3 Strikes",
        text: `User u/${author} has reached 3 strikes. Please review for potential ban.\nLast incident: ${reason}`,
      });
      // Using hSet to simulate a set for escalated users
      await context.redis.hSet("users:three_strikes", { [author]: "1" });
    }

  } catch (error) {
    console.error("Action execution failed:", error);
  }
}
