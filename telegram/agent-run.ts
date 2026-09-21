import { tool, ToolLoopAgent, stepCountIs } from "ai";
import { z } from "zod";
import { getAgentModel } from "../ai/ai.config.ts";
import { ActionTracker } from "../modes/agents/action-tracker.ts";
import { ToolExecutor } from "../modes/agents/tool-executor.ts";
import { createAgentTools } from "../modes/agents/agent-tool.ts";
import { defaultAgentConfig, type AgentConfig } from "../modes/agents/types.ts";
import { createWebTools } from "../modes/plan/web-tools.ts";
import type { Plan, PlanStep } from "../modes/plan/types.ts";
import { replyMd } from "./text.ts";
import { finishOrApprove } from "./approval-session.ts";
import { env } from "../src/config/env";
import { ExecutionLimits } from "./execution-limits.ts";
import {
  DURABLE_MEMORY_INSTRUCTIONS,
  saveDurableMemories,
  withMemoryContext,
} from "../memory/agent-memory.ts";

function readOnlyConfig(): AgentConfig {
  const c = defaultAgentConfig();
  c.tools.allowFileCreation = false;
  c.tools.allowFileModification = false;
  c.tools.allowFolderCreation = false;
  c.tools.allowShellExecution = false;
  return c;
}

function agentOptions(config: AgentConfig, limits: ExecutionLimits, instructions?: string) {
    return {
        model:getAgentModel(),  
        stopWhen: [
          stepCountIs(env.MAX_AGENT_STEPS),
          ({ steps }: { steps: Array<{ toolCalls?: unknown[] }> }) =>
            limits.shouldStop(steps.reduce((total, step) => total + (step.toolCalls?.length ?? 0), 0)),
        ],
        instructions: instructions ?? [
          `You are Clawbot AI, an expert autonomous software engineer working in this repository.`,
          `Workspace Root: ${config.codebasePath}`,
          `Inspect the codebase before making changes. Stage all file modifications accurately for user review.`,
          DURABLE_MEMORY_INSTRUCTIONS,
        ].join("\n"),
    }
}

async function generateWithinLimits<T, TOptions extends { prompt: string }>(
  agent: { generate: (options: TOptions) => Promise<T> },
  prompt: string,
  limits: ExecutionLimits,
): Promise<T> {
  limits.throwIfExceeded();
  const options = {
    prompt,
    abortSignal: limits.signal,
    onStepFinish: ({ toolCalls }: { toolCalls: unknown[] }) => limits.recordToolCalls(toolCalls.length),
  } as unknown as TOptions;
  return agent.generate(options);
}

async function runWithinTaskLimits<T>(work: (limits: ExecutionLimits) => Promise<T>): Promise<T> {
  const limits = new ExecutionLimits();
  try {
    return await work(limits);
  } finally {
    limits.dispose();
  }
}

function createReadOnlyTools(executor: ToolExecutor) {
  return {
    read_file: tool({
      description: "Read a workspace file (relative path).",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path: p }) => executor.readFile(p),
    }),
    list_files: tool({
      description: "List files/dirs at a path.",
      inputSchema: z.object({
        path: z.string(),
        recursive: z.boolean().optional().default(false),
      }),
      execute: async ({ path: p, recursive }) =>
        executor.listFiles(p, recursive),
    }),
    search_files: tool({
      description:
        "Find files matching a glob pattern; optional content filter.",
      inputSchema: z.object({
        root: z.string(),
        pattern: z.string(),
        content_contains: z.string().optional(),
      }),
      execute: async ({ root, pattern, content_contains }) =>
        executor.searchFiles(root, pattern, content_contains),
    }),
    analyze_codebase: tool({
      description: "Summarize the codebase structure.",
      inputSchema: z.object({ path: z.string().default(".") }),
      execute: async ({ path: p }) => executor.analyzeCodebase(p),
    }),
  };
}

function extraWebTools(tracker: ActionTracker) {
  return env.FIRECRAWL_API_KEY ? createWebTools(tracker) : {};
}


export async function runAsk(ctx:{reply:(t:string , o?:object)=>Promise<unknown>} , chatId: number, question:string){
 return runWithinTaskLimits(async (limits) => {

  const userId = `telegram:${chatId}`;
  const config = { ...readOnlyConfig(), userId };
    const tracker = new ActionTracker(config.sessionId, config.userId);
  const executor = new ToolExecutor(tracker, config);
  const tools = { ...createReadOnlyTools(executor), ...extraWebTools(tracker) };
  const askInstructions = [
    `You are Clawbot AI in Telegram Ask Mode—an expert software architect and codebase advisor.`,
    `Workspace Root: ${config.codebasePath}`,
    ``,
    `Guidelines:`,
    `1. Use search_files, read_file, and list_files to investigate the codebase thoroughly before answering.`,
    `2. Keep Telegram responses concise, clear, and formatted in clean Markdown.`,
    `3. You have read-only access in this mode.`,
    DURABLE_MEMORY_INSTRUCTIONS,
  ].join("\n");

  const agent = new ToolLoopAgent({
    ...agentOptions(config, limits, askInstructions),
    tools,
  });

  const memoryIdentity = {
    userId,
    projectId: config.projectId,
    conversationId: config.sessionId,
  };
  const memoryContext = await withMemoryContext(question, memoryIdentity);
  const {text}=await generateWithinLimits(agent, [memoryContext, question].filter(Boolean).join("\n\n"), limits);

  await replyMd(ctx,text||("No response from agent"));
  await saveDurableMemories(text ?? "", memoryIdentity);
 });
}

export async function runAgent(ctx: { reply: (t: string, o?: object) => Promise<unknown> }, chatId: number, goal: string) {
 return runWithinTaskLimits(async (limits) => {
  const config = defaultAgentConfig({ userId: `telegram:${chatId}` });
  const tracker = new ActionTracker(config.sessionId, config.userId);
  const executor = new ToolExecutor(tracker, config);
  const tools = createAgentTools(executor);

  const agentInstructions = [
    `You are Clawbot AI, an expert autonomous software engineer operating via Telegram.`,
    `Workspace Root: ${config.codebasePath}`,
    ``,
    `Guidelines:`,
    `1. Explore existing files first using read_file or search_files before making changes.`,
    `2. Stage all file modifications cleanly. The user will review and approve them before they are applied.`,
    `3. Make surgical, minimal edits respecting existing project style and types.`,
    `4. Keep Telegram responses clear and concise.`,
    DURABLE_MEMORY_INSTRUCTIONS,
  ].join("\n");

  const agent = new ToolLoopAgent({
    ...agentOptions(config, limits, agentInstructions),
    tools,
  });
  const memoryIdentity = {
    userId: config.userId,
    projectId: config.projectId,
    conversationId: config.sessionId,
  };
  const memoryContext = await withMemoryContext(goal, memoryIdentity);
  const { text } = await generateWithinLimits(agent, [memoryContext, goal].filter(Boolean).join("\n\n"), limits);
  if (text?.trim()) await replyMd(ctx, text.trim());
  await saveDurableMemories(text ?? "", memoryIdentity);
 await finishOrApprove(ctx, chatId, tracker, executor, ' Done. No file changes were needed.');
 });
}

export async function runPlanSteps(
  ctx: { reply: (t: string, o?: object) => Promise<unknown> },
  chatId: number,
  plan: Plan,
  steps: PlanStep[],
) {
 return runWithinTaskLimits(async (limits) => {
  const config = defaultAgentConfig({ userId: `telegram:${chatId}` });
  const tracker = new ActionTracker(config.sessionId, config.userId);
  const executor = new ToolExecutor(tracker, config);
  const tools = { ...createAgentTools(executor), ...extraWebTools(tracker) };

  for (const step of steps) {
    await ctx.reply(`🔧 Executing: *${step.title}*`, { parse_mode: 'Markdown' });
    const prompt = [`Goal: ${plan.goal}`, `Step: ${step.title}`, step.description].join('\n');
    const stepInstructions = [
      `You are Clawbot AI executing plan step: "${step.title}" towards the goal: "${plan.goal}".`,
      `Workspace Root: ${config.codebasePath}`,
      `Focus strictly on this step. Stage file changes cleanly for user review.`,
      DURABLE_MEMORY_INSTRUCTIONS,
    ].join("\n");
    const agent = new ToolLoopAgent({
      ...agentOptions(config, limits, stepInstructions),
      tools,
    });
    const memoryIdentity = {
      userId: config.userId,
      projectId: config.projectId,
      conversationId: config.sessionId,
    };
    const memoryContext = await withMemoryContext(prompt, memoryIdentity);
    const { text } = await generateWithinLimits(agent, [memoryContext, prompt].filter(Boolean).join("\n\n"), limits);
    if (text?.trim()) await replyMd(ctx, text.trim());
    await saveDurableMemories(text ?? "", memoryIdentity);
  }

//THIS WILL CALL THE FINISH-RUN FUNCTION
 await finishOrApprove(ctx, chatId, tracker, executor, ' All steps done. No file changes needed.');
 });
}
