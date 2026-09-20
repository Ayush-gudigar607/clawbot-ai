import { describe, expect, test } from "bun:test";
import { redact } from "../../src/logger/redaction";
import { checkCommandPolicy } from "../../security/command-policy";

describe("secret leak security", () => {
  test("redacts credentials from structured log metadata", () => {
    const safe = redact({
      apiKey: "secret-api-key",
      authorization: "Bearer secret-token",
      message: "token=secret-token",
    });

    expect(JSON.stringify(safe)).not.toContain("secret-api-key");
    expect(JSON.stringify(safe)).not.toContain("secret-token");
  });

  test("blocks .env reads through shell policy", () => {
    expect(checkCommandPolicy("cat .env").allowed).toBe(false);
  });
});
