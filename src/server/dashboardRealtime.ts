import { realtime } from "@devvit/web/server";
import {
  resolveDashboardChannel,
  type DashboardRefreshMessage,
} from "../shared/dashboardRealtime.js";

export type { DashboardRefreshMessage };
export { dashboardChannel, resolveDashboardChannel } from "../shared/dashboardRealtime.js";

/** Notify open dashboards that Redis stats changed (Devvit realtime, not socket.io). */
export async function broadcastDashboardRefresh(
  subredditId?: string,
  subredditName?: string
): Promise<void> {
  const channel = resolveDashboardChannel(subredditId, subredditName);
  if (!channel) return;

  try {
    await realtime.send<DashboardRefreshMessage>(channel, { type: "refresh" });
  } catch (err) {
    console.error("Dashboard realtime broadcast failed:", err);
  }
}
