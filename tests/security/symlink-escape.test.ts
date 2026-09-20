import { describe, expect, test } from "bun:test";
import { mkdtemp, symlink, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ActionTracker } from "../../modes/agents/action-tracker";
import { ToolExecutor } from "../../modes/agents/tool-executor";
import { defaultAgentConfig } from "../../modes/agents/types";

describe("symlink escape security", () => {
  test("rejects a symlink pointing outside the workspace", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "clawbot-link-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "clawbot-outside-"));
    try {
      await writeFile(path.join(outside, "secret.txt"), "secret");
      try {
        await symlink(outside, path.join(workspace, "linked"), "junction");
      } catch {
        return;
      }

      const config = { ...defaultAgentConfig({ userId: "test-user" }), codebasePath: workspace };
      const executor = new ToolExecutor(new ActionTracker(config.sessionId, config.userId), config);
      await expect(executor.readFile("linked/secret.txt")).rejects.toThrow(/symlink|escapes workspace/i);
    } finally {
      await rm(workspace, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
});
