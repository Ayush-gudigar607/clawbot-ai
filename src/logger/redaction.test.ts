import { describe, expect, test } from "bun:test";
import { redact } from "./redaction";

describe("redact", () => {
  test("redacts sensitive keys and credential-like values recursively", () => {
    const result = redact({
      apiKey: "should-not-appear",
      nested: {
        authorization: "Bearer should-not-appear",
        message: "token=should-not-appear",
      },
    }) as Record<string, unknown>;

    expect(result.apiKey).toBe("[REDACTED]");
    expect(result.nested).toEqual({
      authorization: "[REDACTED]",
      message: "token=[REDACTED]",
    });
  });
});
