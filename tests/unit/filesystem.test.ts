import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ActionTracker } from "../../modes/agents/action-tracker";
import { ToolExecutor } from "../../modes/agents/tool-executor";
import { defaultAgentConfig } from "../../modes/agents/types";

describe("ToolExecutor filesystem staging", () => {
  test("stages file creation without writing before approval", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "clawbot-files-"));
    try {
      const config = { ...defaultAgentConfig({ userId: "test-user" }), codebasePath: workspace };
      const executor = new ToolExecutor(new ActionTracker(config.sessionId, config.userId), config);

      await executor.createFile("hello.txt", "hello");

      expect(await Bun.file(path.join(workspace, "hello.txt")).exists()).toBe(false);
      expect(executor.getStagedContent("hello.txt")).toBe("hello");
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
