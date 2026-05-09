import { describe, expect, it } from "vitest";
import { getDecision } from "../moderation/decisionEngine.js";

describe("decisionEngine", () => {
  it("removes for confidence >= 0.90", () => {
    expect(getDecision(0.9)).toBe("remove");
    expect(getDecision(0.99)).toBe("remove");
  });

  it("reports for confidence between 0.70 and 0.89", () => {
    expect(getDecision(0.7)).toBe("report");
    expect(getDecision(0.89)).toBe("report");
  });

  it("ignores below 0.70", () => {
    expect(getDecision(0.69)).toBe("ignore");
    expect(getDecision(0.4)).toBe("ignore");
  });
});
