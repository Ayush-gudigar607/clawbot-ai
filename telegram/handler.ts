import type { Telegraf } from "telegraf";
import { isOwner } from "./auth";
import { WELCOME } from "./constant";
import { clip, commandArg, reportAgentError } from "./text";
import { runAgent, runAsk, runPlanSteps } from "./agent-run";
import { generatePlan } from "../modes/plan/planner";
import { planMessage, planKeyboard, getPlanSession, storePlanSession, removePlanSession, type PlanSession, refreshPlanUi } from "./plan-session";
import { approvalDiff, getApprovalSession, removeApprovalSession } from "./approval-session";
import { logger } from "../src/logger";
import {
  acquireExecution,
  allowRequest,
  markCallbackHandled,
  validateTask,
  withTelegramRetry,
} from "./hardening";

async function answerCallback(
  ctx: { answerCbQuery: (text?: string) => Promise<unknown> },
  text?: string,
) {
  try {
    await withTelegramRetry("answerCallbackQuery", () => ctx.answerCbQuery(text));
  } catch (error) {
    if (
      error instanceof Error &&
      /query is too old|response timeout expired|query id is invalid/i.test(error.message)
    ) {
      return;
    }
    throw error;
  }
}

async function reply(
  ctx: { reply: (text: string, options?: object) => Promise<unknown> },
  text: string,
  options?: object,
): Promise<unknown> {
  return withTelegramRetry("reply", () => ctx.reply(text, options));
}

export function registerHandlers(bot: Telegraf) {
         bot.command("start",async(ctx)=>
        {
            if(!isOwner(ctx.chat.id))
            {
                return;
            }

            await reply(ctx, WELCOME, {parse_mode: "Markdown"});
        })

        bot.command("ask", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    const q = commandArg(ctx.message.text, "ask");
    if (!q)
      return reply(ctx, "Usage: `/ask <your question>`", {
        parse_mode: "Markdown",
      });
    if (validateTask(q)) return reply(ctx, validateTask(q)!);
    if (!allowRequest(ctx.chat.id)) return reply(ctx, "Too many requests. Please try again later.");
    const release = acquireExecution(ctx.chat.id);
    if (!release) return reply(ctx, "An agent task is already running or the bot is busy.");

    await reply(ctx, "🔍 Researching your question…");
    void runAsk(ctx, ctx.chat.id, q)
      .catch((error) => reportAgentError(ctx, error, '/ask'))
      .finally(release);
  });

   bot.command("agent", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    const goal = commandArg(ctx.message.text, "agent");
    if (!goal)
      return reply(ctx, "Usage: `/agent <task description>`", {
        parse_mode: "Markdown",
      });
    if (validateTask(goal)) return reply(ctx, validateTask(goal)!);
    if (!allowRequest(ctx.chat.id)) return reply(ctx, "Too many requests. Please try again later.");
    const release = acquireExecution(ctx.chat.id);
    if (!release) return reply(ctx, "An agent task is already running or the bot is busy.");
    await reply(ctx, "🤖 Agent is working on your task…");
    void runAgent(ctx, ctx.chat.id, goal)
      .catch((error) => reportAgentError(ctx, error, '/agent'))
      .finally(release);
  });

  bot.command("plan", async (ctx) => {
    if (!isOwner(ctx.chat.id)) return;
    const goal = commandArg(ctx.message.text, "plan");

    if (!goal)
      return reply(ctx, "Usage: `/plan <your goal>`", {
        parse_mode: "Markdown",
      });
    if (validateTask(goal)) return reply(ctx, validateTask(goal)!);
    if (!allowRequest(ctx.chat.id)) return reply(ctx, "Too many requests. Please try again later.");
    const release = acquireExecution(ctx.chat.id);

    await reply(ctx, "Generating a plan…");

    void (async ()=>{
        const plan = await generatePlan(goal)
        const session: PlanSession = {
          plan,
          selected: new Set(plan.steps.map((s) => s.id)),
          expiresAt: 0,
        };
        await reply(ctx, planMessage(session), {parse_mode:"Markdown", ...planKeyboard(session)});
         storePlanSession(ctx.chat.id, session);
    })().catch((error) => reportAgentError(ctx, error, '/plan'))
      .finally(() => release?.());
  });

   bot.action(/^plan_toggle:(.+)$/, async (ctx) => {
    if (!isOwner(ctx.chat!.id)) return answerCallback(ctx);
    const callbackId = ctx.callbackQuery.id;
    if (!markCallbackHandled(callbackId)) return answerCallback(ctx, "Already handled");
    const s = getPlanSession(ctx.chat!.id);
    if (!s) return answerCallback(ctx);

    await answerCallback(ctx);

    const id = ctx.match[1]!;
    if (s.selected.has(id)) s.selected.delete(id);
    else s.selected.add(id);
    storePlanSession(ctx.chat!.id, s);

    await refreshPlanUi(ctx, s);
  });

  bot.action('plan_all', async (ctx) => {
    if (!isOwner(ctx.chat!.id)) return answerCallback(ctx);
    if (!markCallbackHandled(ctx.callbackQuery.id)) return answerCallback(ctx, "Already handled");
    const s = getPlanSession(ctx.chat!.id);
    if (!s) return answerCallback(ctx);
    await answerCallback(ctx);
    for (const step of s.plan.steps) s.selected.add(step.id);
    storePlanSession(ctx.chat!.id, s);
    await refreshPlanUi(ctx, s);
  });

  bot.action('plan_none', async (ctx) => {
    if (!isOwner(ctx.chat!.id)) return answerCallback(ctx);
    if (!markCallbackHandled(ctx.callbackQuery.id)) return answerCallback(ctx, "Already handled");
    const s = getPlanSession(ctx.chat!.id);
    if (!s) return answerCallback(ctx);
    await answerCallback(ctx);
    s.selected.clear();
    storePlanSession(ctx.chat!.id, s);
    await refreshPlanUi(ctx, s);
  });


  bot.action('plan_proceed', async (ctx) => {
    if (!isOwner(ctx.chat!.id)) return answerCallback(ctx);
    if (!markCallbackHandled(ctx.callbackQuery.id)) return answerCallback(ctx, "Already handled");
    const s = getPlanSession(ctx.chat!.id);
    if (!s) return answerCallback(ctx);

    const steps = s.plan.steps.filter((step) => s.selected.has(step.id));
    if (steps.length === 0) return answerCallback(ctx);

    await answerCallback(ctx);

    const { plan } = s;
    const release = acquireExecution(ctx.chat!.id);
    if (!release) return answerCallback(ctx, "Another task is already running");
    removePlanSession(ctx.chat!.id);
    const list = steps.map((step, i) => `${i + 1}. ${step.title}`).join('\n');
    await withTelegramRetry("editMessageText", () =>
      ctx.editMessageText(`🚀 Executing ${steps.length} step(s)…\n\n${list}`),
    );

    void runPlanSteps(ctx, ctx.chat!.id, plan, steps)
      .catch((error) => reportAgentError(ctx, error, 'plan execution'))
      .finally(release);
  });

  bot.action('approval_diff', async (ctx) => {
    if (!isOwner(ctx.chat!.id)) return answerCallback(ctx);
    if (!markCallbackHandled(ctx.callbackQuery.id)) return answerCallback(ctx, "Already handled");
    const s = getApprovalSession(ctx.chat!.id);
    if (!s) return answerCallback(ctx);
    await answerCallback(ctx);
    await reply(ctx, clip(approvalDiff(s.pending)));
  });


   bot.action('approval_accept', async (ctx) => {
    if (!isOwner(ctx.chat!.id)) return answerCallback(ctx);
    if (!markCallbackHandled(ctx.callbackQuery.id)) return answerCallback(ctx, "Already handled");
    const s = getApprovalSession(ctx.chat!.id);
    if (!s) return answerCallback(ctx);

    await answerCallback(ctx, 'Applying...');

    removeApprovalSession(ctx.chat!.id);
    for (const a of s.pending) s.tracker.updateStatus(a.id, 'approved', true);
    const { errors } = await s.executor.applyApprovedFromTracker();
    s.executor.clearStaging();

    await withTelegramRetry("editMessageText", () => ctx.editMessageText('✅ All changes applied.'));
    if (errors.length) logger.error("Telegram changes failed", { errors });
  });

  bot.action('approval_reject', async (ctx) => {
    if (!isOwner(ctx.chat!.id)) return answerCallback(ctx);
    if (!markCallbackHandled(ctx.callbackQuery.id)) return answerCallback(ctx, "Already handled");
    const s = getApprovalSession(ctx.chat!.id);
    if (!s) return answerCallback(ctx);

    await answerCallback(ctx, 'Rejecting...');

    removeApprovalSession(ctx.chat!.id);
    for (const a of s.pending) s.tracker.updateStatus(a.id, 'rejected', false);
    s.executor.clearStaging();

    await withTelegramRetry("editMessageText", () => ctx.editMessageText('❌ All changes rejected. Nothing was applied.'));
  });

}


