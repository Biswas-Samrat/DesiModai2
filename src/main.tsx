import { Devvit } from "@devvit/public-api";
import { handleCommentCreate } from "./triggers/onCommentCreate.js";
import { handlePostCreate } from "./triggers/onPostCreate.js";
import { Dashboard } from "./dashboard/dashboard.js";

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
  name: "dashboard",
  description: "DesiMod AI Moderation Dashboard",
  render: Dashboard,
});

// Subreddit menu item: open/create a dashboard post
Devvit.addMenuItem({
  label: "Open DesiMod Dashboard",
  location: "subreddit",
  forUserType: "moderator",
  onPress: async (_event, context) => {
    try {
      const subreddit = await context.reddit.getCurrentSubreddit();
      const redisKey = `dashboard_post_id:${subreddit.name}`;

      // 1. DUP CHECK: Try to find an existing dashboard post
      const existingPostId = await context.redis.get(redisKey);
      if (existingPostId) {
        try {
          const existingPost = await context.reddit.getPostById(existingPostId);
          if (existingPost) {
            context.ui.showToast("Opening existing dashboard...");
            context.ui.navigateTo(existingPost);
            return;
          }
        } catch (e) {
          // Post might have been deleted, proceed to create a new one
          console.log("Existing dashboard post not found, creating a new one.");
        }
      }

      // 2. CREATE: Use submitPost with a preview (Modern Devvit Blocks approach)
      const post = await context.reddit.submitPost({
        title: "DesiMod AI Moderation Dashboard",
        subredditName: subreddit.name,
        preview: (
          <vstack padding="large" alignment="center middle" gap="medium">
            <image url="https://i.redd.it/snoo_loading.gif" imageWidth={48} imageHeight={48} />
            <text size="large" weight="bold">DesiMod AI Dashboard</text>
            <text size="small">Initializing secure moderator view...</text>
          </vstack>
        ),
      });

      // 3. PERSIST & PIN: Store the ID to avoid duplicates and sticky the post
      await context.redis.set(redisKey, post.id);
      await post.sticky();

      context.ui.showToast("✅ Dashboard created and pinned!");

      // 4. NAVIGATE: Open the dashboard post immediately
      context.ui.navigateTo(post);
    } catch (err) {
      console.error("Dashboard creation failed:", err);
      context.ui.showToast("❌ Failed to create dashboard.");
    }
  },
});

export default Devvit;