import { describe, expect, test } from "bun:test";
import { extractDurableMemories } from "./agent-memory";

describe("extractDurableMemories", () => {
  test("only accepts explicit durable memory lines and deduplicates them", () => {
    const result = extractDurableMemories([
      "The user's prompt should not be saved.",
      "Memory: The project uses Bun for its runtime.",
      "memory: The project uses Bun for its runtime.",
      "Memory: API_KEY: do not save this secret.",
    ].join("\n"));

    expect(result).toEqual([
      {
        content: "The project uses Bun for its runtime.",
        reason: "Explicitly marked durable memory",
      },
    ]);
  });
});
