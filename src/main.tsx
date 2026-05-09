import { Devvit } from "@devvit/public-api";
import { ModDashboard } from "./dashboard/modDashboard.js";
import { handleCommentCreate } from "./triggers/onCommentCreate.js";
import { handlePostCreate } from "./triggers/onPostCreate.js";

Devvit.configure({
  redditAPI: true
});

Devvit.addTrigger({
  event: "CommentCreate",
  onEvent: async (event, context) => {
    await handleCommentCreate(event as never, context);
  }
});

Devvit.addTrigger({
  event: "PostCreate",
  onEvent: async (event, context) => {
    await handlePostCreate(event as never, context);
  }
});

Devvit.addCustomPostType({
  name: "AI Mod Dashboard",
  render: ModDashboard
});

Devvit.addMenuItem({
  label: "Open AI Moderation Dashboard",
  location: "subreddit",
  onPress: async (_event, context) => {
    const subreddit = await context.reddit.getCurrentSubreddit();
    await context.reddit.submitPost({
      title: "AI Moderation Dashboard",
      subredditName: subreddit.name,
      preview: <vstack><text>Open to view moderation analytics</text></vstack>,
      customPost: "AI Mod Dashboard"
    });
  }
});

export default Devvit;
