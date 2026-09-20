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

function agentOptions(config: AgentConfig, limits: ExecutionLimits) {
    return {
        model:getAgentModel(),  
        stopWhen: [
          stepCountIs(env.MAX_AGENT_STEPS),
          ({ steps }: { steps: Array<{ toolCalls?: unknown[] }> }) =>
            limits.shouldStop(steps.reduce((total, step) => total + (step.toolCalls?.length ?? 0), 0)),
        ],
        instructions:`Workspace root:${config.codebasePath}\n${DURABLE_MEMORY_INSTRUCTIONS}`
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
  const agent = new ToolLoopAgent({
    ...agentOptions(config, limits),
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
  const agent = new ToolLoopAgent({
    ...agentOptions(config, limits),
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
    const agent = new ToolLoopAgent({
      ...agentOptions(config, limits),
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
