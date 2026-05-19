export type DashboardRefreshMessage = {
  type: "refresh";
};

export function dashboardChannel(subredditId: string): string {
  return `desimod-dashboard:${subredditId}`;
}
