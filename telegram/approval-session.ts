import { Markup } from 'telegraf';
import { ActionTracker } from '../modes/agents/action-tracker.ts';
import { ToolExecutor } from '../modes/agents/tool-executor.ts';
import type { ActionLog } from '../modes/agents/types.ts';
import { composeBeforeAfter, formatPatch } from '../modes/agents/diff-view.ts';
import { clip } from './text.ts';
import { withTelegramRetry } from './hardening';
import { env } from '../src/config/env';
import { defaultAgentConfig } from '../modes/agents/types.ts';
import {
  deleteApprovalSession,
  readApprovalSession,
  writeApprovalSession,
} from './persistent-sessions';

export interface ApprovalSession {
  tracker: ActionTracker;
  executor: ToolExecutor;
  pending: readonly ActionLog[];
  expiresAt: number;
}

export const approvalSessions = new Map<number, ApprovalSession>();

export function removeApprovalSession(chatId: number): void {
  approvalSessions.delete(chatId);
  deleteApprovalSession(chatId);
}

export function getApprovalSession(chatId: number): ApprovalSession | undefined {
  const session = approvalSessions.get(chatId);
  if (!session) {
    const persisted = readApprovalSession(chatId);
    if (!persisted || persisted.pending.length === 0) return undefined;
    const first = persisted.pending[0]!;
    const tracker = new ActionTracker(first.sessionId, first.userId);
    tracker.restore(persisted.pending);
    const executor = new ToolExecutor(
      tracker,
      defaultAgentConfig({ sessionId: first.sessionId, userId: first.userId }),
    );
    approvalSessions.set(chatId, {
      tracker,
      executor,
      pending: tracker.getPendingMutations(),
      expiresAt: persisted.expiresAt,
    });
  }
  const active = approvalSessions.get(chatId)!;
  if (active.expiresAt <= Date.now()) {
    approvalSessions.delete(chatId);
    deleteApprovalSession(chatId);
    return undefined;
  }
  return active;
}

export function clearExpiredApprovalSessions(): void {
  for (const [chatId, session] of approvalSessions) {
    if (session.expiresAt <= Date.now()) {
      approvalSessions.delete(chatId);
      deleteApprovalSession(chatId);
    }
  }
}

function groupPending(pending: readonly ActionLog[]) {
  const files = new Map<string, ActionLog[]>();
  const shells: ActionLog[] = [];
  for (const a of pending) {
    if (a.type === 'tool_execute') shells.push(a);
    else {
      if (!files.has(a.path)) files.set(a.path, []);
      files.get(a.path)!.push(a);
    }
  }
  return { files, shells };
}

export function approvalSummary(pending: readonly ActionLog[]): string {
  const { files, shells } = groupPending(pending);
  const fileLines = [...files].map(([path, actions]) => {
    const types = [...new Set(actions.map((a) => a.type.replace(/_/g, ' ')))].join(', ');
    return `📄 ${path} (${types})`;
  });
  const shellLines = shells.map((s) => `🖥 Shell: ${s.details.command}`);
  return ['Staged changes — review before applying', '', ...fileLines, ...shellLines, '', `Total: ${pending.length} change(s)`].join('\n');
}

export function approvalDiff(pending: readonly ActionLog[]): string {
  const { files, shells } = groupPending(pending);
  const parts: string[] = [];
  for (const [filePath, actions] of files) {
    const sorted = [...actions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const { before, after } = composeBeforeAfter(sorted);
    parts.push(clip(formatPatch(filePath, before, after), 1500));
  }
  for (const s of shells) parts.push(`🖥 Shell: ${s.details.command}`);
  return parts.join('\n\n').trim();
}

async function promptApproval(
  ctx: { reply: (t: string, o?: object) => Promise<unknown> },
  chatId: number,
  session: ApprovalSession,
) {
  const storedSession = {
    ...session,
    expiresAt: Date.now() + env.TELEGRAM_APPROVAL_TTL_MS,
  };
  approvalSessions.set(chatId, storedSession);
  writeApprovalSession(chatId, storedSession);
  await withTelegramRetry("replyApproval", () =>
    ctx.reply(approvalSummary(session.pending), {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 Show Diff', 'approval_diff')],
        [
          Markup.button.callback('✅ Accept All', 'approval_accept'),
          Markup.button.callback('❌ Reject All', 'approval_reject'),
        ],
      ]),
    }),
  );
}

export async function finishOrApprove(
  ctx: { reply: (t: string, o?: object) => Promise<unknown> },
  chatId: number,
  tracker: ActionTracker,
  executor: ToolExecutor,
  noChangesMsg: string,
) {
  const pending = tracker.getPendingMutations();
  if (pending.length === 0) {
    await ctx.reply(noChangesMsg);
    return;
  }
  await promptApproval(ctx, chatId, { tracker, executor, pending, expiresAt: 0 });
}