import { serve } from "@hono/node-server";
import { createServer, getServerPort, context, reddit, redis, settings } from "@devvit/web/server";
import type { MenuItemRequest, TriggerResponse, UiResponse } from "@devvit/web/shared";
import { Hono } from "hono";
import { getDashboardStats } from "../storage/analyticsStore.js";
import type { AppContext } from "../types/devvit.js";
import { handleCommentCreate } from "../triggers/onCommentCreate.js";
import { handlePostCreate } from "../triggers/onPostCreate.js";

const DASHBOARD_TITLE = "DesiMod AI Moderation Dashboard";
const DEFAULT_SUBREDDIT = "DesiModTest_Samrat";

const app = new Hono();
const api = new Hono();
const internal = new Hono();

function appContext(): AppContext {
  return {
    reddit,
    redis,
    settings,
    subredditId: context.subredditId,
    subredditName: context.subredditName,
    postId: context.postId,
  };
}

async function getCurrentSubredditName(): Promise<string> {
  if (context.subredditName) {
    return context.subredditName;
  }

  try {
    const subreddit = await reddit.getCurrentSubreddit();
    return subreddit?.name ?? DEFAULT_SUBREDDIT;
  } catch {
    return DEFAULT_SUBREDDIT;
  }
}

async function isCurrentUserMod(subredditName: string): Promise<boolean> {
  const mods = await reddit.getModerators({ subredditName }).all();

  if (context.userId) {
    if (mods.some((mod) => mod.id === context.userId)) {
      return true;
    }
  }

  const username =
    context.username ?? (await reddit.getCurrentUsername());
  if (username) {
    const normalized = username.toLowerCase();
    if (
      mods.some(
        (mod) => mod.username?.toLowerCase() === normalized
      )
    ) {
      return true;
    }
  }

  return false;
}

api.get("/dashboard", async (c) => {
  const rawDays = Number(c.req.query("days") ?? "1");
  const days = rawDays === 3 || rawDays === 7 ? rawDays : 1;
  const subredditName =
    context.subredditName ?? (await getCurrentSubredditName());

  try {
    const [isMod, stats] = await Promise.all([
      isCurrentUserMod(subredditName),
      getDashboardStats(redis, days),
    ]);

    if (!isMod) {
      console.log(
        `[INFO] dashboard hidden from non-mods: ${context.postId ?? "unknown"}`
      );
      return c.json({ isMod: false });
    }

    const username =
      context.username ?? (await reddit.getCurrentUsername()) ?? "unknown";

    return c.json({
      isMod: true,
      username,
      toxicRemovals: stats.toxicRemovals,
      scamRemovals: stats.scamRemovals,
      warnings: stats.warnings,
      escalations: stats.escalations,
      timeSaved: stats.estimatedTimeSavedMinutes,
    });
  } catch (err) {
    console.error("Dashboard data fetch failed:", err);
    return c.json({ isMod: false }, 500);
  }
});

internal.post("/menu/open-dashboard", async (c) => {
  await c.req.json<MenuItemRequest>().catch(() => undefined);

  try {
    const subredditName = await getCurrentSubredditName();
    const redisKey = `dashboard_post_id:${subredditName}`;

    let existingPost = null;
    let existingPostId = await redis.get(redisKey);

    if (existingPostId) {
      try {
        existingPost = await reddit.getPostById(existingPostId as `t3_${string}`);
      } catch {
        console.log(`[INFO] Dashboard post ID ${existingPostId} stored in Redis could not be fetched.`);
      }
    }

    if (!existingPost) {
      console.log(`[INFO] Searching hot posts in r/${subredditName} for an existing DesiMod AI Moderation Dashboard post...`);
      try {
        const hotPosts = await reddit.getHotPosts({ subredditName, limit: 20 }).all();
        const found = hotPosts.find((post: { title?: string }) => post.title === DASHBOARD_TITLE);
        if (found) {
          existingPost = found;
          existingPostId = found.id;
          await redis.set(redisKey, found.id);
        }
      } catch (err) {
        console.error("Error searching hot posts for dashboard:", err);
      }
    }

    if (!existingPost) {
      console.log(`[INFO] Searching new posts in r/${subredditName} for an existing DesiMod AI Moderation Dashboard post...`);
      try {
        const newPosts = await reddit.getNewPosts({ subredditName, limit: 20 }).all();
        const found = newPosts.find((post: { title?: string }) => post.title === DASHBOARD_TITLE);
        if (found) {
          existingPost = found;
          existingPostId = found.id;
          await redis.set(redisKey, found.id);
        }
      } catch (err) {
        console.error("Error searching new posts for dashboard:", err);
      }
    }

    if (existingPost) {
      console.log(`[INFO] dashboard already exists: ${existingPost.id}`);

      try {
        await existingPost.sticky();
        console.log(`[INFO] dashboard highlighted: ${existingPost.id}`);
      } catch (err) {
        console.error("Error stickying existing dashboard:", err);
      }

      try {
        await reddit.remove(existingPost.id, false);
        console.log(`[INFO] dashboard hidden from non-mods: ${existingPost.id}`);
      } catch (err) {
        console.error("Error removing existing dashboard:", err);
      }

      return c.json<UiResponse>({
        showToast: "Opening existing dashboard...",
        navigateTo: existingPost,
      });
    }

    const post = await reddit.submitCustomPost({
      title: DASHBOARD_TITLE,
      subredditName,
      entry: "default",
      textFallback: {
        text: "DesiMod AI moderation analytics dashboard for subreddit moderators.",
      },
      styles: {
        backgroundColor: "#1A1A1BFF",
        backgroundColorDark: "#1A1A1BFF",
        height: "TALL" as never,
      },
    });

    console.log(`[INFO] dashboard created: ${post.id}`);
    await redis.set(redisKey, post.id);

    try {
      await post.sticky();
      console.log(`[INFO] dashboard highlighted: ${post.id}`);
    } catch (err) {
      console.error("Error stickying new dashboard:", err);
    }

    try {
      await reddit.remove(post.id, false);
      console.log(`[INFO] dashboard hidden from non-mods: ${post.id}`);
    } catch (err) {
      console.error("Error removing new dashboard:", err);
    }

    return c.json<UiResponse>({
      showToast: {
        text: "Dashboard created and secured!",
        appearance: "success",
      },
      navigateTo: post,
    });
  } catch (err) {
    console.error("Dashboard creation failed:", err);
    return c.json<UiResponse>({
      showToast: {
        text: "Failed to create dashboard.",
        appearance: "neutral",
      },
    });
  }
});

internal.post("/triggers/comment-submit", async (c) => {
  const event = await c.req.json();
  await handleCommentCreate(event, appContext());
  return c.json<TriggerResponse>({ status: "ok" });
});

internal.post("/triggers/post-submit", async (c) => {
  const event = await c.req.json();
  await handlePostCreate(event, appContext());
  return c.json<TriggerResponse>({ status: "ok" });
});

app.route("/api", api);
app.route("/internal", internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
