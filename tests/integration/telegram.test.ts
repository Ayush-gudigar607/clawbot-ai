import { describe, expect, test } from "bun:test";
import {
  acquireExecution,
  allowRequest,
  markCallbackHandled,
  resetTelegramHardeningState,
  validateTask,
} from "../../telegram/hardening";
import { env } from "../../src/config/env";

describe("Telegram integration guards", () => {
  test("enforces task size and duplicate callback protection", () => {
    expect(validateTask("x".repeat(env.TELEGRAM_MAX_TASK_LENGTH + 1))).toMatch(/too long/i);
    expect(markCallbackHandled("callback-1")).toBe(true);
    expect(markCallbackHandled("callback-1")).toBe(false);
    resetTelegramHardeningState();
  });

  test("limits concurrent executions", () => {
    resetTelegramHardeningState();
    const releases = Array.from({ length: env.MAX_CONCURRENT_AGENTS }, (_, index) =>
      acquireExecution(index + 1),
    );
    expect(releases.every(Boolean)).toBe(true);
    expect(acquireExecution(999)).toBeNull();
    for (const release of releases) release?.();
  });

  test("rate limits repeated requests", () => {
    resetTelegramHardeningState();
    for (let index = 0; index < env.TELEGRAM_RATE_LIMIT_MAX; index += 1) {
      expect(allowRequest(42)).toBe(true);
    }
    expect(allowRequest(42)).toBe(false);
    resetTelegramHardeningState();
  });
});
