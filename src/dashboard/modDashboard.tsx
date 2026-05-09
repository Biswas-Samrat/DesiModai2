import { useAsync, useState } from "@devvit/public-api";
import type { Context } from "@devvit/public-api";
import { getStatsForDays } from "../storage/analyticsStore.js";

async function isModerator(context: Context): Promise<boolean> {
  const currentUser = await context.reddit.getCurrentUsername();
  const subreddit = await context.reddit.getCurrentSubreddit();
  const mods = await context.reddit.getModerators({ subredditName: subreddit.name });
  return mods.some((mod) => mod.username === currentUser);
}

export const ModDashboard = (_props: Record<string, never>, context: Context): JSX.Element => {
  const [days, setDays] = useState(7);

  const { data: modAccess, loading: modLoading } = useAsync(async () => isModerator(context));
  const { data: stats, loading: statsLoading } = useAsync(async () => getStatsForDays(days), {
    depends: [days]
  });

  if (modLoading || statsLoading) {
    return (
      <vstack padding="medium">
        <text>Loading moderation dashboard...</text>
      </vstack>
    );
  }

  if (!modAccess) {
    return (
      <vstack padding="medium">
        <text>Moderator access required.</text>
      </vstack>
    );
  }

  if (days < 1 || days > 7) {
    return (
      <vstack padding="medium">
        <text>Invalid date range. Choose between 1 and 7 days.</text>
      </vstack>
    );
  }

  if (!stats || stats.toxicRemovals + stats.scamRemovals + stats.warnings + stats.escalations === 0) {
    return (
      <vstack padding="medium" gap="small">
        <text size="xlarge" weight="bold">
          AI Moderation Dashboard
        </text>
        <text>No moderation activity in selected range.</text>
        <hstack gap="small">
          <button onPress={() => setDays(1)}>1 day</button>
          <button onPress={() => setDays(3)}>3 days</button>
          <button onPress={() => setDays(7)}>7 days</button>
        </hstack>
      </vstack>
    );
  }

  return (
    <vstack padding="medium" gap="small">
      <text size="xlarge" weight="bold">
        AI Moderation Dashboard
      </text>
      <text>Date range: last {days} day(s)</text>
      <hstack gap="small">
        <button onPress={() => setDays(1)}>1 day</button>
        <button onPress={() => setDays(3)}>3 days</button>
        <button onPress={() => setDays(7)}>7 days</button>
      </hstack>
      <text>Total toxic removals: {stats?.toxicRemovals ?? 0}</text>
      <text>Total scam removals: {stats?.scamRemovals ?? 0}</text>
      <text>Total warnings: {stats?.warnings ?? 0}</text>
      <text>Users escalated to ModMail: {stats?.escalations ?? 0}</text>
      <text>Estimated moderator time saved: {stats?.estimatedTimeSavedMinutes ?? 0} minutes</text>
    </vstack>
  );
};
