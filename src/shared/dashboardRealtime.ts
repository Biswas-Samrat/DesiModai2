export type DashboardRefreshMessage = {
  type: "refresh";
};

/**
 * Devvit realtime channel names may only contain [a-zA-Z0-9_].
 * @see @devvit/realtime/client/realtime.js
 */
export function dashboardChannel(subredditKey: string): string {
  const safe = subredditKey.replace(/[^a-zA-Z0-9_]/g, "_");
  return `desimod_dashboard_${safe}`;
}

export function resolveDashboardChannel(
  subredditId?: string,
  subredditName?: string
): string | null {
  if (subredditId) {
    return dashboardChannel(subredditId);
  }
  if (subredditName) {
    return dashboardChannel(subredditName.toLowerCase());
  }
  return null;
}
