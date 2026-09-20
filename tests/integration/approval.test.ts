import { describe, expect, test } from "bun:test";
import { ActionTracker } from "../../modes/agents/action-tracker";
import { ToolExecutor } from "../../modes/agents/tool-executor";
import { defaultAgentConfig } from "../../modes/agents/types";
import {
  approvalSessions,
  finishOrApprove,
  removeApprovalSession,
} from "../../telegram/approval-session";

describe("approval integration", () => {
  test("keeps simultaneous approvals isolated by chat", async () => {
    const replies: string[] = [];
    const context = { reply: async (text: string) => { replies.push(text); } };
    const sessions: Array<{ chatId: number; tracker: ActionTracker; executor: ToolExecutor }> = [];

    for (const chatId of [101, 202]) {
      const config = defaultAgentConfig({ sessionId: `session-${chatId}`, userId: `user-${chatId}` });
      const tracker = new ActionTracker(config.sessionId, config.userId);
      tracker.log({
        type: "file_create",
        path: `file-${chatId}.txt`,
        details: { after: "content" },
        status: "pending",
      });
      sessions.push({ chatId, tracker, executor: new ToolExecutor(tracker, config) });
    }

    await Promise.all(sessions.map((session) =>
      finishOrApprove(context, session.chatId, session.tracker, session.executor, "none"),
    ));

    expect(replies).toHaveLength(2);
    expect(approvalSessions.has(101)).toBe(true);
    expect(approvalSessions.has(202)).toBe(true);
    removeApprovalSession(101);
    removeApprovalSession(202);
  });
});
