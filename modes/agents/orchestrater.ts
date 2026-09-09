import { confirm, isCancel, text } from "@clack/prompts";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";
import { ToolExecutor } from "./tool-executor";
import { createToolExecutor } from "./agent-tool";
import { stepCountIs, ToolLoopAgent } from "ai";
import { getAgentModel } from "../../ai";
import chalk from "chalk";

export async function runAgentMode() {
  console.log(chalk.bold("Starting Clawbot AI in Agent mode..."));

  const goal = await text({
    message: "What would you like the agent to do?",
    placeholder: "Concreate task for this codebase...",
  });

  if (isCancel(goal) || !goal.trim()) {
    return;
  }

  const config = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);
  const tools = createToolExecutor(executor);

  const agent = new ToolLoopAgent({
    model: getAgentModel(),
    //stepCountIs is a function that returns a function that checks if the step count is greater than or equal to the given number
    stopWhen: stepCountIs(40),
    instructions: [
      `workspace root:${config.codebasePath}`,
      `All mutations are stagged until approval`,
    ].join("\n"),
    tools,
  });

  try {
    const result = await agent.generate({
      prompt: goal.trim(),
      onStepFinish: ({ toolCalls }) => {
        for (const tc of toolCalls) {
          // Log the tool call to the console with a preview of the input
          const preview = JSON.stringify(tc.input).slice(0, 160);
          console.log(
            chalk.blue("✔"),
            chalk.bold(String(tc.toolName)),
            chalk.dim(preview + (preview.length >= 160 ? "..." : "")),
          );
        }
      },
    });

    if (result.text.trim()) {
      console.log(chalk.green("\nAgent:"), result.text);
    }

    const pending = tracker.getPendingMutations();
    if (pending.length === 0) {
      return;
    }

    console.log(chalk.yellow("\nPending changes:"));
    for (const action of pending) {
      console.log(`- ${action.type}: ${action.path}`);
    }

    const approval = await confirm({
      message: "Apply these changes to the workspace?",
      initialValue: false,
    });

    if (isCancel(approval) || !approval) {
      for (const action of pending) {
        tracker.updateStatus(action.id, "rejected", false);
      }
      console.log(chalk.yellow("Changes rejected; no files were modified."));
      return;
    }

    for (const action of pending) {
      tracker.updateStatus(action.id, "approved", true);
    }

    const { errors } = executor.applyApprovedFromTracker();
    if (errors.length > 0) {
      console.error(chalk.red("Some approved changes failed:"));
      for (const error of errors) {
        console.error(chalk.red(`- ${error}`));
      }
    } else {
      console.log(chalk.green("Changes applied successfully."));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red("Agent failed:"), message);
  }
}
