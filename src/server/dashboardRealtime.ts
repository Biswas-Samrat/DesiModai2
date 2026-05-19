import { realtime } from "@devvit/web/server";
import {
  dashboardChannel,
  type DashboardRefreshMessage,
} from "../shared/dashboardRealtime.js";

export { dashboardChannel, type DashboardRefreshMessage };

/** Notify open dashboards that Redis stats changed (Devvit realtime, not WebSockets). */
export async function broadcastDashboardRefresh(
  subredditId: string | undefined
): Promise<void> {
  if (!subredditId) return;

  try {
    await realtime.send<DashboardRefreshMessage>(dashboardChannel(subredditId), {
      type: "refresh",
    });
  } catch (err) {
    console.error("Dashboard realtime broadcast failed:", err);
  }
}
