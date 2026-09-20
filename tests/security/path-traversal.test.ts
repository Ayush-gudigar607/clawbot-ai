import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ActionTracker } from "../../modes/agents/action-tracker";
import { ToolExecutor } from "../../modes/agents/tool-executor";
import { defaultAgentConfig } from "../../modes/agents/types";

describe("path traversal security", () => {
  test("rejects ../../../secret.txt outside the workspace", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "clawbot-traversal-"));
    try {
      const config = { ...defaultAgentConfig({ userId: "security-test" }), codebasePath: workspace };
      const executor = new ToolExecutor(new ActionTracker(config.sessionId, config.userId), config);
      await expect(executor.readFile("../../../secret.txt")).rejects.toThrow(/workspace|resolve/i);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
