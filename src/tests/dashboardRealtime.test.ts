import { describe, expect, it } from "vitest";
import {
  dashboardChannel,
  resolveDashboardChannel,
} from "../shared/dashboardRealtime.js";

describe("dashboard realtime channels", () => {
  it("uses only Devvit-allowed characters", () => {
    expect(dashboardChannel("t5_abc")).toBe("desimod_dashboard_t5_abc");
    expect(dashboardChannel("swarna999")).toBe("desimod_dashboard_swarna999");
    expect(dashboardChannel("t5:abc")).toBe("desimod_dashboard_t5_abc");
  });

  it("prefers subreddit id over name", () => {
    expect(resolveDashboardChannel("t5_xyz", "swarna999")).toBe(
      "desimod_dashboard_t5_xyz"
    );
    expect(resolveDashboardChannel(undefined, "swarna999")).toBe(
      "desimod_dashboard_swarna999"
    );
  });
});
