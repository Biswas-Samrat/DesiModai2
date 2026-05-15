import { Devvit } from "@devvit/public-api";
import { handleCommentCreate } from "./triggers/onCommentCreate.js";
import { handlePostCreate } from "./triggers/onPostCreate.js";
import { ModDashboard } from "./dashboard/modDashboard.js";

// Declare all capabilities the app needs
Devvit.configure({
  redditAPI: true,
  redis: true,
  http: true, // Required for Gemini API calls
});

// Settings: Gemini API key stored securely in Devvit (NOT process.env)
Devvit.addSettings([
  {
    type: "string",
    name: "gemini_api_key",
    label: "Gemini API Key",
    helpText: "Your Google AI Studio API key for Gemini 1.5 Flash. Keep this secret.",
    isSecret: true,
    scope: "app",
  },
]);

// Trigger: Scan every new comment
Devvit.addTrigger({
  event: "CommentSubmit",
  onEvent: handleCommentCreate,
});

// Trigger: Scan every new post
Devvit.addTrigger({
  event: "PostSubmit",
  onEvent: handlePostCreate,
});

// Custom Post Type: Mod Analytics Dashboard
Devvit.addCustomPostType({
  name: "DesiMod Dashboard",
  description: "AI moderation analytics for r/DesiModTest_Samrat",
  render: ModDashboard,
});

// Subreddit menu item: create a dashboard post
Devvit.addMenuItem({
  label: "Create DesiMod Dashboard",
  location: "subreddit",
  forUserType: "moderator",
  onPress: async (_event, context) => {
    try {
      const subreddit = await context.reddit.getCurrentSubreddit();
      await context.reddit.submitPost({
        title: "DesiMod AI — Moderation Dashboard",
        subredditName: subreddit.name,
        preview: (
          <vstack padding="large" alignment="center middle">
            <text size="large" weight="bold">
              DesiMod AI Dashboard
            </text>
            <text size="small">Loading stats...</text>
          </vstack>
        ),
      });
      context.ui.showToast("✅ Dashboard post created!");
    } catch (err) {
      console.error("Menu item error:", err);
      context.ui.showToast("❌ Failed to create dashboard. Check mod permissions.");
    }
  },
});

export default Devvit;