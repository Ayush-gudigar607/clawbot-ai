import chalk from "chalk";
import { confirm, isCancel, text } from "@clack/prompts";
import { ToolLoopAgent, stepCountIs } from "ai";
import { getAgentModel } from "../../ai/ai.config.ts";
import { ActionTracker } from "../agents/action-tracker.ts";
import { ToolExecutor } from "../agents/tool-executor.ts";
import { createToolExecutor } from "../agents/agent-tool.ts";
import { defaultAgentConfig } from "../agents/types.ts";
import { runApprovalFlow } from "../agents/approval.ts";
import { renderTerminalMarkdown } from "../../terminalui/terminal-md.ts";


export async function runPlanMode():Promise<void>
{
  console.log(chalk.bold("\n Plan Mode\n"));
  
  const goal=await text({
    message:"What is your goal?",
    placeholder:"e.g. I want to add a new feature to my project",
  });

  if(isCancel(goal) || !goal.trim()) return

  const plan=await generatePlan(goal)


}