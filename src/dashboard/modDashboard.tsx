import { Devvit, useAsync } from "@devvit/public-api";

export const ModDashboard: Devvit.CustomPostComponent = (context) => {
  const { data, loading, error } = useAsync(async () => {
    try {
      const toxic = await context.redis.get("stats:removals:toxic") || "0";
      const scam = await context.redis.get("stats:removals:scam") || "0";
      const warnings = await context.redis.get("stats:warnings") || "0";
      const threeStrikes = await context.redis.hKeys("users:three_strikes") || [];

      return {
        toxic,
        scam,
        warnings,
        threeStrikes: threeStrikes.length,
        userList: threeStrikes
      };
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      throw err;
    }
  });

  if (loading) return <vstack padding="large"><text>Loading Analytics...</text></vstack>;
  if (error) return <vstack padding="large"><text color="red">Error loading dashboard</text></vstack>;

  return (
    <vstack padding="large" gap="medium">
      <text size="xlarge" weight="bold">DesiMod AI Dashboard</text>
      
      <hstack gap="medium">
        <vstack border="thin" padding="medium" grow>
          <text size="large" weight="bold">{data?.toxic}</text>
          <text size="small">Toxic Removals</text>
        </vstack>
        <vstack border="thin" padding="medium" grow>
          <text size="large" weight="bold">{data?.scam}</text>
          <text size="small">Scam Removals</text>
        </vstack>
      </hstack>

      <hstack gap="medium">
        <vstack border="thin" padding="medium" grow>
          <text size="large" weight="bold">{data?.warnings}</text>
          <text size="small">Total Warnings</text>
        </vstack>
        <vstack border="thin" padding="medium" grow>
          <text size="large" weight="bold">{data?.threeStrikes}</text>
          <text size="small">Users with 3+ Strikes</text>
        </vstack>
      </hstack>

      {data?.userList && data.userList.length > 0 ? (
        <vstack gap="small" border="thin" padding="medium">
          <text weight="bold">Escalated Users:</text>
          {data.userList.slice(0, 5).map(user => (
            <text size="small">• u/{user}</text>
          ))}
        </vstack>
      ) : null}

      <button
        onPress={() => context.ui.showToast("Stats refreshed!")}
        appearance="primary"
      >
        Refresh Data
      </button>
    </vstack>
  );
};
