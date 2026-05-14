import { Devvit } from "@devvit/public-api";
import { handleCommentCreate } from "./triggers/onCommentCreate.js";
import { handlePostCreate } from "./triggers/onPostCreate.js";
import { ModDashboard } from "./dashboard/modDashboard.js";

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Settings for API Key
Devvit.addSettings([
  {
    type: "string",
    name: "gemini_api_key",
    label: "Gemini API Key",
    isSecret: true,
    scope: "app",
  },
]);

// Trigger: Comment Submission
Devvit.addTrigger({
  event: "CommentSubmit",
  onEvent: handleCommentCreate,
});

// Trigger: Post Submission
Devvit.addTrigger({
  event: "PostSubmit",
  onEvent: handlePostCreate,
});

// Custom Post Type for Dashboard
Devvit.addCustomPostType({
  name: "DesiMod Dashboard",
  render: ModDashboard,
});

// Menu Item to create Dashboard
Devvit.addMenuItem({
  label: "Create DesiMod Dashboard",
  location: "subreddit",
  onPress: async (_event, context) => {
    try {
      const subreddit = await context.reddit.getCurrentSubreddit();
      await context.reddit.submitPost({
        title: "DesiMod AI Moderation Dashboard",
        subredditName: subreddit.name,
        preview: (
          <vstack padding="large">
            <text size="large">Loading DesiMod Dashboard...</text>
          </vstack>
        ),
      });
      context.ui.showToast("Dashboard post created!");
    } catch (err) {
      console.error("Menu item error:", err);
      context.ui.showToast("Failed to create dashboard");
    }
  },
});

export default Devvit;