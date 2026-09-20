import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ActionTracker } from "../../modes/agents/action-tracker";
import { ToolExecutor } from "../../modes/agents/tool-executor";
import { defaultAgentConfig } from "../../modes/agents/types";

async function executorFor(workspace: string) {
  const config = { ...defaultAgentConfig({ userId: "test-user" }), codebasePath: workspace };
  return new ToolExecutor(new ActionTracker(config.sessionId, config.userId), config);
}

describe("path security", () => {
  test("rejects traversal outside the workspace", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "clawbot-path-"));
    try {
      const executor = await executorFor(workspace);
      await expect(executor.readFile("../../../secret.txt")).rejects.toThrow(/workspace|resolve/i);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
