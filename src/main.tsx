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

      let existingPost = null;
      let existingPostId = await context.redis.get(redisKey);

      // 1. DUP CHECK: Try to find an existing dashboard post in Redis
      if (existingPostId) {
        try {
          existingPost = await context.reddit.getPostById(existingPostId);
        } catch (e) {
          console.log(`[INFO] Dashboard post ID ${existingPostId} stored in Redis could not be fetched (likely deleted).`);
        }
      }

      // 2. DUP CHECK: If not found in Redis, search hot posts in the subreddit to be absolutely sure
      if (!existingPost) {
        console.log(`[INFO] Searching hot posts in r/${subreddit.name} for an existing DesiMod AI Moderation Dashboard post...`);
        try {
          const hotPosts = await context.reddit.getHotPosts({
            subredditName: subreddit.name,
            limit: 20,
          }).all();

          const found = hotPosts.find((p) => p.title === "DesiMod AI Moderation Dashboard");
          if (found) {
            existingPost = found;
            existingPostId = found.id;
            await context.redis.set(redisKey, found.id);
          }
        } catch (err) {
          console.error("Error searching hot posts for dashboard:", err);
        }
      }

      // 3. DUP CHECK: If still not found, check new posts in the subreddit to cover all bases
      if (!existingPost) {
        console.log(`[INFO] Searching new posts in r/${subreddit.name} for an existing DesiMod AI Moderation Dashboard post...`);
        try {
          const newPosts = await context.reddit.getNewPosts({
            subredditName: subreddit.name,
            limit: 20,
          }).all();

          const found = newPosts.find((p) => p.title === "DesiMod AI Moderation Dashboard");
          if (found) {
            existingPost = found;
            existingPostId = found.id;
            await context.redis.set(redisKey, found.id);
          }
        } catch (err) {
          console.error("Error searching new posts for dashboard:", err);
        }
      }

      // 4. REUSE EXISTING DASHBOARD: If found, secure it and open it
      if (existingPost) {
        console.log(`[INFO] dashboard already exists: ${existingPost.id}`);
        console.log(`[INFO] dashboard reused: ${existingPost.id}`);
        context.ui.showToast("Opening existing dashboard...");

        try {
          await existingPost.sticky();
          console.log(`[INFO] dashboard highlighted: ${existingPost.id}`);
        } catch (err) {
          console.error("Error stickying existing dashboard:", err);
        }

        try {
          await context.reddit.remove(existingPost.id, false);
          console.log(`[INFO] dashboard hidden from non-mods: ${existingPost.id}`);
        } catch (err) {
          console.error("Error removing existing dashboard:", err);
        }

        context.ui.navigateTo(existingPost);
        return;
      }

      // 5. CREATE NEW DASHBOARD: Submit post with a preview (Modern Devvit Blocks approach)
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

      console.log(`[INFO] dashboard created: ${post.id}`);

      // Store the new dashboard ID in Redis for subsequent quick accesses
      await context.redis.set(redisKey, post.id);

      try {
        await post.sticky();
        console.log(`[INFO] dashboard highlighted: ${post.id}`);
      } catch (err) {
        console.error("Error stickying new dashboard:", err);
      }

      try {
        await context.reddit.remove(post.id, false);
        console.log(`[INFO] dashboard hidden from non-mods: ${post.id}`);
      } catch (err) {
        console.error("Error removing new dashboard:", err);
      }

      context.ui.showToast("✅ Dashboard created and secured!");
      context.ui.navigateTo(post);
    } catch (err) {
      console.error("Dashboard creation failed:", err);
      context.ui.showToast("❌ Failed to create dashboard.");
    }
  },
});

export default Devvit;