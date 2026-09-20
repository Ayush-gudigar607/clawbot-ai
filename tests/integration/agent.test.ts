import { describe, expect, test } from "bun:test";
import { ExecutionLimits } from "../../telegram/execution-limits";
import { env } from "../../src/config/env";

describe("agent execution integration", () => {
  test("aborts when the tool-call budget is exceeded", () => {
    const limits = new ExecutionLimits();
    try {
      limits.recordToolCalls(env.MAX_TOOL_CALLS + 1);
      expect(limits.signal.aborted).toBe(true);
      expect(() => limits.throwIfExceeded()).toThrow(/limit/i);
    } finally {
      limits.dispose();
    }
  });
});
