import { describe, expect, test } from "bun:test";
import { checkCommandPolicy } from "../../security/command-policy";

describe("command injection security", () => {
  test("blocks rm -rf", () => {
    expect(checkCommandPolicy("rm -rf /").allowed).toBe(false);
  });

  test("blocks command chaining and shell execution", () => {
    expect(checkCommandPolicy("git status && rm -rf /").allowed).toBe(false);
    expect(checkCommandPolicy("cat file.txt | sh").allowed).toBe(false);
  });
});
