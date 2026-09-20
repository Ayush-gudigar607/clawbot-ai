import { describe, expect, test } from "bun:test";
import { env } from "../../src/config/env";

describe("configuration", () => {
  test("provides validated execution defaults", () => {
    expect(["openrouter", "gemini"]).toContain(env.AI_PROVIDER);
    expect(env.MAX_AGENT_STEPS).toBeGreaterThan(0);
    expect(env.MAX_TOOL_CALLS).toBeGreaterThan(0);
    expect(env.MAX_TASK_DURATION_MS).toBeGreaterThan(0);
  });
});
