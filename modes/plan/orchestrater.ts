import chalk from "chalk";
import { confirm, isCancel, text } from "@clack/prompts";
import { ToolLoopAgent, stepCountIs, type LanguageModel } from "ai";
import { getAgentModel } from "../../ai/ai.config.ts";
import { ActionTracker } from "../agents/action-tracker.ts";
import { ToolExecutor } from "../agents/tool-executor.ts";
import { createAgentTools } from "../agents/agent-tool.ts";
import { defaultAgentConfig } from "../agents/types.ts";
import { runApprovalFlow } from "../agents/approval.ts";
import { renderTerminalMarkdown, logToolCall } from "../../terminalui/terminal-md.ts";
import { generatePlan } from "./planner.ts";
import { printPlan,selectSteps } from "./selection.ts";
import type { Plan, PlanStep } from "./types.ts";
import { createWebTools } from "./web-tools.ts";
import {
  DURABLE_MEMORY_INSTRUCTIONS,
  saveDurableMemories,
  withMemoryContext,
} from "../../memory/agent-memory.ts";
import { randomUUID } from "node:crypto";
import { logger } from "../../src/logger";
import { env } from "../../src/config/env";


function stepPrompt(goal: string, step: PlanStep): string {
  return [`Goal: ${goal}`, `Step: ${step.title}`, step.description].join('\n');
}

export async function runPlanMode():Promise<void>
{
  logger.info(chalk.bold("\n Plan Mode\n"));
  
  const goal=await text({
    message:"What is your goal?",
    placeholder:"e.g. I want to add a new feature to my project",
  });

  if(isCancel(goal) || !goal.trim()) return

  const plan=await generatePlan(goal)

  printPlan(plan)

  const selected=await selectSteps(plan);
  if(selected.length===0) return

  const proceed=await confirm({
    message:`You have selected ${selected.length} steps. Do you want to proceed?`,
    initialValue:true,
  })

  if(isCancel(proceed) || !proceed) return;

  const sessionId=randomUUID();
  const userId=env.CLAWBOT_USER_ID ?? "local-user";

  const config=defaultAgentConfig({
    sessionId,
    userId
  })

  const tracker=new ActionTracker(sessionId,userId);
  const executor=new ToolExecutor(tracker,config);

  const tools={
    ...createAgentTools(executor),
    ...createWebTools(tracker),
  };

  for(const step of selected)
  {
    logger.info(chalk.cyan(`\nExecuting step: ${step.title}\n`));
    const agent=new ToolLoopAgent({
    model: getAgentModel() as unknown as LanguageModel,
      stopWhen:stepCountIs(20),
      instructions: [
        `You are Clawbot AI executing a specific plan step towards the overall goal: "${plan.goal}".`,
        `Workspace Root: ${config.codebasePath}`,
        `Current Step: ${step.title}`,
        ``,
        `### Execution Guidelines:`,
        `1. Focused Work: Implement only what is required for this step. Do not modify unrelated code.`,
        `2. Codebase Awareness: Use read_file or search_files to inspect existing files before making changes.`,
        `3. Safe Staging: Accurately stage all file creations or modifications. They will be reviewed by the user.`,
        `4. Durable Memory: ${DURABLE_MEMORY_INSTRUCTIONS}`,
        `5. Brief Completion: Briefly summarize what was completed for this step when done.`,
      ].join("\n"),
      tools
    })

    const memoryIdentity = {
      userId,
      projectId: config.projectId,
      conversationId: sessionId,
    };
    const stepText=stepPrompt(plan.goal,step);
    const memoryContext=await withMemoryContext(stepText, memoryIdentity);

    const r = await agent.generate({
      prompt: [memoryContext, stepText].filter(Boolean).join("\n\n"),
      onStepFinish: ({ toolCalls }) => {
        for (const tc of toolCalls) {
          logToolCall(String(tc.toolName), tc.input);
        }
      },
    });

    if (r.text) console.log("\n" + renderTerminalMarkdown(r.text));
  await saveDurableMemories(r.text ?? "", memoryIdentity);

 
  }
  const ok=await runApprovalFlow(tracker);
  if(!ok) return executor.clearStaging();

  const {errors}=await executor.applyApprovedFromTracker();
   if (errors.length) {
    logger.error("Some operations reported errors", { errors });
  } else {
    logger.info(chalk.green('\n✓ Applied.\n'));
  }
  executor.clearStaging();
}
