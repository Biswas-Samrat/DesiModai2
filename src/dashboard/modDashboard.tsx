/**
 * modDashboard.tsx — Devvit custom post component for the DesiMod AI dashboard.
 *
 * Shows daily stats fetched from Devvit's built-in Redis.
 * Supports date range selector: Last 1 / 3 / 7 days.
 */
import { Devvit, useState, useAsync } from "@devvit/public-api";

type DateRange = 1 | 3 | 7;

export const ModDashboard: Devvit.CustomPostComponent = (context) => {
  const [days, setDays] = useState<DateRange>(1);

  const { data, loading, error } = useAsync(
    async () => {
      const safeDays = days as number;
      const todayIso = () => new Date().toISOString().slice(0, 10);

      let toxicRemovals = 0;
      let scamRemovals = 0;
      let warnings = 0;
      let escalations = 0;

      for (let i = 0; i < safeDays; i++) {
        const day = new Date();
        day.setUTCDate(day.getUTCDate() - i);
        const dayIso = day.toISOString().slice(0, 10);

        const [toxic, scam, warn, modmail] = await Promise.all([
          context.redis.get(`stats:toxic:${dayIso}`),
          context.redis.get(`stats:scam:${dayIso}`),
          context.redis.get(`stats:warnings:${dayIso}`),
          context.redis.get(`stats:modmail:${dayIso}`),
        ]);

        toxicRemovals += Number(toxic ?? 0);
        scamRemovals += Number(scam ?? 0);
        warnings += Number(warn ?? 0);
        escalations += Number(modmail ?? 0);
      }

      return {
        toxicRemovals,
        scamRemovals,
        warnings,
        escalations,
        timeSaved: (toxicRemovals + scamRemovals) * 3,
      };
    },
    { depends: [days] }
  );

  const rangeLabel =
    days === 1 ? "Last 1 day" : days === 3 ? "Last 3 days" : "Last 7 days";

  if (loading) {
    return (
      <vstack padding="large" alignment="center middle">
        <text size="large">Loading analytics...</text>
      </vstack>
    );
  }

  if (error) {
    return (
      <vstack padding="large" alignment="center middle">
        <text color="red">Error loading dashboard. Please try again.</text>
      </vstack>
    );
  }

  return (
    <vstack padding="large" gap="medium">
      {/* Header */}
      <hstack alignment="start middle" gap="small">
        <text size="xlarge" weight="bold">
          DesiMod AI Dashboard
        </text>
      </hstack>

      {/* Date Range Selector */}
      <hstack gap="small">
        <button
          appearance={days === 1 ? "primary" : "secondary"}
          onPress={() => setDays(1)}
          size="small"
        >
          Last 1 day
        </button>
        <button
          appearance={days === 3 ? "primary" : "secondary"}
          onPress={() => setDays(3)}
          size="small"
        >
          Last 3 days
        </button>
        <button
          appearance={days === 7 ? "primary" : "secondary"}
          onPress={() => setDays(7)}
          size="small"
        >
          Last 7 days
        </button>
      </hstack>

      <text size="small" color="secondary-plain">
        Showing stats for: {rangeLabel}
      </text>

      {/* Stats Cards Row 1 */}
      <hstack gap="medium">
        <vstack border="thin" padding="medium" grow alignment="center middle">
          <text size="xlarge" weight="bold">
            {String(data?.toxicRemovals ?? 0)}
          </text>
          <text size="small">Toxic Removals</text>
        </vstack>
        <vstack border="thin" padding="medium" grow alignment="center middle">
          <text size="xlarge" weight="bold">
            {String(data?.scamRemovals ?? 0)}
          </text>
          <text size="small">Scam Removals</text>
        </vstack>
      </hstack>

      {/* Stats Cards Row 2 */}
      <hstack gap="medium">
        <vstack border="thin" padding="medium" grow alignment="center middle">
          <text size="xlarge" weight="bold">
            {String(data?.warnings ?? 0)}
          </text>
          <text size="small">Warnings Sent</text>
        </vstack>
        <vstack border="thin" padding="medium" grow alignment="center middle">
          <text size="xlarge" weight="bold">
            {String(data?.escalations ?? 0)}
          </text>
          <text size="small">ModMail Escalations</text>
        </vstack>
      </hstack>

      {/* Time Saved */}
      <vstack border="thin" padding="medium" alignment="center middle">
        <text size="large" weight="bold">
          ~{String(data?.timeSaved ?? 0)} min
        </text>
        <text size="small">Estimated Mod Time Saved</text>
      </vstack>

      {/* Refresh */}
      <button
        appearance="secondary"
        onPress={() => context.ui.showToast(`Stats refreshed for ${rangeLabel}`)}
        size="small"
      >
        Refresh
      </button>
    </vstack>
  );
};
