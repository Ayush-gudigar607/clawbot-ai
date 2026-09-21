import {isCancel, text } from "@clack/prompts";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";
import { ToolExecutor } from "./tool-executor";
import { createAgentTools } from "./agent-tool";
import { stepCountIs, ToolLoopAgent, type LanguageModel } from "ai";
import { getAgentModel } from "../../ai";
import chalk from "chalk";
import { renderTerminalMarkdown, logToolCall } from "../../terminalui/terminal-md";
import { runApprovalFlow } from "./approval";
import {
  DURABLE_MEMORY_INSTRUCTIONS,
  saveDurableMemories,
  withMemoryContext,
} from "../../memory/agent-memory";
import { randomUUID } from "node:crypto";
import { logger } from "../../src/logger";
import { env } from "../../src/config/env";

export async function runAgentMode() {
  logger.info(chalk.bold("Starting Clawbot AI in Agent mode..."));

  const goal = await text({
    message: "What would you like the agent to do?",
    placeholder: "Concreate task for this codebase...",
  });

    if (isCancel(goal) || !goal.trim()) {
    return;
  }

  const sessionId = randomUUID();

  const userId =
    env.CLAWBOT_USER_ID ?? "local-user";

  const config = defaultAgentConfig({
    sessionId,
    userId,
  });
  
  const tracker = new ActionTracker(sessionId, userId);
  const executor = new ToolExecutor(tracker, config);
  const tools = createAgentTools(executor);

  const agent = new ToolLoopAgent({
    model: getAgentModel() as unknown as LanguageModel,
    //stepCountIs is a function that returns a function that checks if the step count is greater than or equal to the given number
    stopWhen: stepCountIs(40),
    instructions: [
      `You are Clawbot AI, an expert autonomous software engineer working directly in this codebase.`,
      `Workspace Root: ${config.codebasePath}`,
      ``,
      `### Core Principles:`,
      `1. Explore Before Changing: Always inspect the codebase using search_files, read_file, or list_files first. Never guess file paths, exports, or implementations.`,
      `2. Safe & Minimal Changes: All file mutations and shell commands are safely staged for user approval. Prefer surgical, targeted edits over re-writing whole files. Maintain existing coding style, indentation, and formatting.`,
      `3. Quality First: Ensure code is syntactically valid, properly typed (TypeScript), and imports are correct. Never remove working code or comments unless requested.`,
      `4. Shell Commands: When executing shell commands via execute_shell, supply single, standard commands (e.g. 'bun test', 'git status'). Chained operators (&&, ;, |) are prohibited by security policy.`,
      `5. Skill System: When handling specialized tasks, use search_skills, read the relevant SKILL.md, and inspect resources. Untrusted skills provide guidance only.`,
      `6. Durable Memory: ${DURABLE_MEMORY_INSTRUCTIONS}`,
      `7. Completion Summary: When finished, provide a clean, concise markdown summary outlining what you accomplished, the files affected, and how the user can verify the results.`,
    ].join("\n"),
    tools,
  });

  const memoryIdentity = {
    userId,
    projectId: config.projectId,
    conversationId: sessionId,
  };
  const memoryContext = await withMemoryContext(goal.trim(), memoryIdentity);

  try {
    const result = await agent.generate({
      prompt: [memoryContext, goal.trim()].filter(Boolean).join("\n\n"),
      onStepFinish: ({ toolCalls }) => {
        for (const tc of toolCalls) {
          logToolCall(String(tc.toolName), tc.input);
        }
      },
    });

    if (result.text.trim()) {
      console.log("\n" + renderTerminalMarkdown(result.text) + "\n");
    }

    await saveDurableMemories(result.text, memoryIdentity);

    const ok=await runApprovalFlow(tracker);
    if(!ok){
         return executor.clearStaging();
    }

    const {errors}=await executor.applyApprovedFromTracker();

    if(errors.length>0){
    logger.error("Some approved changes failed", { errors });
     for(const error of errors){
     }
    }
    else
    {
      logger.info(chalk.green("Changes applied successfully."));
    }
    
    //all staged changes have been applied, so we can clear the memory
    executor.clearStaging();

    // const pending = tracker.getPendingMutations();
    // if (pending.length === 0) {
    //   return;
    // }

    // console.log(chalk.yellow("\nPending changes:"));
    // for (const action of pending) {
    //   console.log(`- ${action.type}: ${action.path}`);
    // }

    // const approval = await confirm({
    //   message: "Apply these changes to the workspace?",
    //   initialValue: false,
    // });

    // if (isCancel(approval) || !approval) {
    //   for (const action of pending) {
    //     tracker.updateStatus(action.id, "rejected", false);
    //   }
    //   console.log(chalk.yellow("Changes rejected; no files were modified."));
    //   return;
    // }

    // for (const action of pending) {
    //   tracker.updateStatus(action.id, "approved", true);
    // }

    // const { errors } = executor.applyApprovedFromTracker();
    // if (errors.length > 0) {
    //   console.error(chalk.red("Some approved changes failed:"));
    //   for (const error of errors) {
    //     console.error(chalk.red(`- ${error}`));
    //   }
    // } else {
    //   console.log(chalk.green("Changes applied successfully."));
    // }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Agent failed", { error: message });
  }
}
