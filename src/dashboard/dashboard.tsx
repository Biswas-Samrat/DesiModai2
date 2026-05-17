/**
 * modDashboard.tsx — Devvit custom post component for the DesiMod AI dashboard.
 *
 * Fixed: Replaced invalid "xxsmall" layout tokens with "xsmall" to satisfy Devvit SDK.
 */
import { Devvit, useState, useAsync } from "@devvit/public-api";

type DateRange = 1 | 3 | 7;

interface DashboardData {
  isMod: boolean;
  username?: string;
  toxicRemovals?: number;
  scamRemovals?: number;
  warnings?: number;
  escalations?: number;
  timeSaved?: number;
  [key: string]: any; // Required for JSONValue compatibility
}

export const Dashboard: Devvit.CustomPostComponent = (context) => {
  const [days, setDays] = useState<DateRange>(1);

  // Consolidated async logic to ensure stability and prevent loops
  const { data, loading, error } = useAsync<DashboardData>(async () => {
    // 1. Security Check
    const subName = context.subredditName ?? "DesiModTest_Samrat";
    const [currentUser, mods] = await Promise.all([
      context.reddit.getCurrentUser(),
      context.reddit.getModerators({ subredditName: subName }).all(),
    ]);

    const isMod = mods.some((mod) => mod.username === currentUser?.username);
    if (!isMod) {
      return { isMod: false };
    }

    // 2. Data Fetching
    const safeDays = days as number;
    let toxicRemovals = 0;
    let scamRemovals = 0;
    let warnings = 0;
    let escalations = 0;

    const statsPromises = [];
    for (let i = 0; i < safeDays; i++) {
      const day = new Date();
      day.setUTCDate(day.getUTCDate() - i);
      const dayIso = day.toISOString().slice(0, 10);

      statsPromises.push(
        Promise.all([
          context.redis.get(`stats:toxic:${dayIso}`),
          context.redis.get(`stats:scam:${dayIso}`),
          context.redis.get(`stats:warnings:${dayIso}`),
          context.redis.get(`stats:modmail:${dayIso}`),
        ])
      );
    }

    const results = await Promise.all(statsPromises);
    for (const [toxic, scam, warn, modmail] of results) {
      toxicRemovals += Number(toxic ?? 0);
      scamRemovals += Number(scam ?? 0);
      warnings += Number(warn ?? 0);
      escalations += Number(modmail ?? 0);
    }

    return {
      isMod: true,
      username: currentUser?.username ?? "unknown",
      toxicRemovals,
      scamRemovals,
      warnings,
      escalations,
      timeSaved: (toxicRemovals + scamRemovals) * 3,
    };
  }, { depends: [days] });

  // --- LOADING VIEW ---
  if (loading) {
    return (
      <vstack padding="large" alignment="center middle" height="100%" gap="medium" backgroundColor="#1A1A1B">
        <icon name="refresh" size="large" color="#00D4BD" />
        <text size="large" weight="bold" color="white">Initializing DesiMod View...</text>
        <text size="small" color="#818384">Fetching latest metrics from Redis...</text>
      </vstack>
    );
  }

  // --- ERROR VIEW ---
  if (error || !data) {
    return (
      <vstack padding="large" alignment="center middle" gap="medium" backgroundColor="#1A1A1B" height="100%">
        <icon name="error" size="large" color="#FF4500" />
        <text color="#FF4500" weight="bold">Dashboard Unavailable</text>
        <text size="small" alignment="center" color="#D7DADC">Failed to load analytics. Please ensure you are a moderator.</text>
        <button onPress={() => setDays(days)}>Retry</button>
      </vstack>
    );
  }

  // --- ACCESS DENIED VIEW ---
  if (!data.isMod) {
    return (
      <vstack padding="large" alignment="center middle" gap="medium" backgroundColor="#1A1A1B" height="100%">
        <icon name="bot" size="large" color="#FF4500" />
        <text size="xlarge" weight="bold" color="#FF4500">Permission Denied</text>
        <text alignment="center" color="#D7DADC">
          This dashboard is restricted to the mod team of r/{context.subredditName ?? "subreddit"}.
        </text>
      </vstack>
    );
  }

  // --- MAIN DASHBOARD VIEW ---
  return (
    <vstack padding="small" gap="small" backgroundColor="#1A1A1B" cornerRadius="medium" height="100%">
      {/* Header */}
      <hstack alignment="start middle" gap="small" padding="small">
        <icon name="mod" color="#00D4BD" />
        <text size="large" weight="bold" color="white">DesiMod AI Insights</text>
        <spacer grow />
        <text size="xsmall" color="#818384">Logged in as: u/{data.username ?? "unknown"}</text>
      </hstack>

      <hstack height="1px" width="100%" backgroundColor="#343536" />

      {/* Re-designed Timeframe Row Selector */}
      <hstack alignment="center middle" gap="medium" padding="small">
        <text size="small" weight="bold" color="#818384">TIMEFRAME</text>

        <hstack backgroundColor="#272729" cornerRadius="full" border="thin" borderColor="#343536" padding="xsmall" alignment="center middle">
          {/* 24h Button Option */}
          <hstack
            padding="small"
            cornerRadius="full"
            backgroundColor={days === 1 ? "#FF4500" : "transparent"}
            onPress={() => setDays(1)}
            alignment="center middle"
          >
            <text size="xsmall" weight="bold" color={days === 1 ? "white" : "#D7DADC"}> 24h </text>
          </hstack>

          {/* 3d Button Option */}
          <hstack
            padding="small"
            cornerRadius="full"
            backgroundColor={days === 3 ? "#FF4500" : "transparent"}
            onPress={() => setDays(3)}
            alignment="center middle"
          >
            <text size="xsmall" weight="bold" color={days === 3 ? "white" : "#D7DADC"}>  3d  </text>
          </hstack>

          {/* 7d Button Option */}
          <hstack
            padding="small"
            cornerRadius="full"
            backgroundColor={days === 7 ? "#FF4500" : "transparent"}
            onPress={() => setDays(7)}
            alignment="center middle"
          >
            <text size="xsmall" weight="bold" color={days === 7 ? "white" : "#D7DADC"}>  7d  </text>
          </hstack>
        </hstack>
      </hstack>

      {/* Stats Grid Rows */}
      <hstack gap="small" grow>
        <vstack border="thin" borderColor="#343536" padding="small" grow alignment="center middle" cornerRadius="small" backgroundColor="#272729">
          <text size="xlarge" weight="bold" color="#FF4500">{String(data.toxicRemovals ?? 0)}</text>
          <text size="xsmall" weight="bold" color="#818384">TOXIC REMOVALS</text>
        </vstack>
        <vstack border="thin" borderColor="#343536" padding="small" grow alignment="center middle" cornerRadius="small" backgroundColor="#272729">
          <text size="xlarge" weight="bold" color="#FFB000">{String(data.scamRemovals ?? 0)}</text>
          <text size="xsmall" weight="bold" color="#818384">SCAM FLAGGED</text>
        </vstack>
      </hstack>

      <hstack gap="small" grow>
        <vstack border="thin" borderColor="#343536" padding="small" grow alignment="center middle" cornerRadius="small" backgroundColor="#272729">
          <text size="xlarge" weight="bold" color="#00D4BD">{String(data.warnings ?? 0)}</text>
          <text size="xsmall" weight="bold" color="#818384">USER WARNINGS</text>
        </vstack>
        <vstack border="thin" borderColor="#343536" padding="small" grow alignment="center middle" cornerRadius="small" backgroundColor="#272729">
          <text size="xlarge" weight="bold" color="#7193FF">{String(data.escalations ?? 0)}</text>
          <text size="xsmall" weight="bold" color="#818384">MODMAIL REPORTS</text>
        </vstack>
      </hstack>

      {/* Time Saved Panel */}
      <vstack border="thin" borderColor="#343536" padding="small" alignment="center middle" cornerRadius="small" backgroundColor="#272729">
        <hstack gap="small" alignment="center middle">
          <icon name="history" color="#00D4BD" size="small" />
          <text size="medium" weight="bold" color="white">~{String(data.timeSaved ?? 0)} minutes</text>
        </hstack>
        <text size="xsmall" color="#818384">Estimated moderator time saved</text>
      </vstack>

      {/* Footer Branding Area */}
      <hstack alignment="center middle" padding="xsmall">
        <text size="xsmall" color="#565758">AI-Powered Moderation for Desi Communities</text>
      </hstack>
    </vstack>
  );
};