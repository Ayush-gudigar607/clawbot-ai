import { Markup } from 'telegraf';
import type { Plan } from '../modes/plan/types';
import { env } from '../src/config/env';
import { withTelegramRetry } from './hardening';
import {
  clearExpiredPersistentSessions,
  deletePlanSession,
  readPlanSession,
  writePlanSession,
} from './persistent-sessions';


export interface PlanSession {
  plan: Plan;
  selected: Set<string>;
  expiresAt: number;
}

export const planSessions = new Map<number, PlanSession>();

export function removePlanSession(chatId: number): void {
  planSessions.delete(chatId);
  deletePlanSession(chatId);
}

export function getPlanSession(chatId: number): PlanSession | undefined {
  const session = planSessions.get(chatId);
  if (!session) {
    const persisted = readPlanSession(chatId);
    if (!persisted) return undefined;
    const restored: PlanSession = {
      plan: persisted.plan,
      selected: new Set(persisted.selected),
      expiresAt: persisted.expiresAt,
    };
    planSessions.set(chatId, restored);
  }
  const active = planSessions.get(chatId)!;
  if (active.expiresAt <= Date.now()) {
    planSessions.delete(chatId);
    deletePlanSession(chatId);
    return undefined;
  }
  return active;
}

export function storePlanSession(chatId: number, session: Omit<PlanSession, 'expiresAt'>): void {
  planSessions.set(chatId, {
    ...session,
    expiresAt: Date.now() + env.TELEGRAM_SESSION_TTL_MS,
  });
  const stored = planSessions.get(chatId)!;
  writePlanSession(chatId, {
    plan: stored.plan,
    selected: [...stored.selected],
    expiresAt: stored.expiresAt,
  });
}

export function clearExpiredPlanSessions(): void {
  for (const [chatId, session] of planSessions) {
    if (session.expiresAt <= Date.now()) {
      planSessions.delete(chatId);
      deletePlanSession(chatId);
    }
  }
  clearExpiredPersistentSessions();
}

export function planMessage(session: PlanSession): string {
  const lines = session.plan.steps.map((step, i) => {
    const mark = session.selected.has(step.id) ? '✅' : '⬜';
    const tag = step.complexity ? ` [${step.complexity}]` : '';
    return `${mark} ${i + 1}. *${step.title}*${tag}`;
  });
  return [
    `📋 *Plan for:* ${session.plan.goal}`,
    '',
    ...lines,
    '',
    '_Tap steps to toggle, then hit Proceed._',
  ].join('\n');
}

export function planKeyboard(session: PlanSession) {
  const rows = session.plan.steps.map((step, i) => {
    const mark = session.selected.has(step.id) ? '✅' : '⬜';
    const label = `${mark} Step ${i + 1}: ${step.title}`;
    return [Markup.button.callback(label, `plan_toggle:${step.id}`)];
  });
  return Markup.inlineKeyboard([
    ...rows,
    [
      Markup.button.callback('✅ Select All', 'plan_all'),
      Markup.button.callback('⬜ Deselect All', 'plan_none'),
    ],
    [Markup.button.callback('🚀 Proceed', 'plan_proceed')],
  ]);
}


export async function refreshPlanUi(
  ctx: { editMessageText: (t: string, o: object) => Promise<unknown> },
  s: PlanSession,
) {
  await withTelegramRetry("editPlanMessage", () =>
    ctx.editMessageText(planMessage(s), {
      parse_mode: 'Markdown',
      reply_markup: planKeyboard(s).reply_markup,
    }),
  );
}