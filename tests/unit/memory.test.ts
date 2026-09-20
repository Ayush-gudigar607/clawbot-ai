import { describe, expect, test } from "bun:test";
import { extractDurableMemories } from "../../memory/agent-memory";

describe("memory", () => {
  test("saves only explicitly marked durable facts", () => {
    const memories = extractDurableMemories([
      "The entire prompt must not be saved.",
      "Memory: The project uses Bun for development.",
      "Memory: The project uses Bun for development.",
      "Memory: API_KEY: do not save secrets.",
    ].join("\n"));

    expect(memories).toHaveLength(1);
    expect(memories[0]?.content).toBe("The project uses Bun for development.");
  });
});
