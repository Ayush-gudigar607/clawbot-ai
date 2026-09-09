import { isCancel, text } from "@clack/prompts";
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
    stopWhen: stepCountIs(40),
    instructions: [
      `workspace root:${config.codebasePath}`,
      `All mutations are stagged until approval`,
    ].join("\n"),
    tools,
  });

  const result=await agent.generate(
    {
        prompt:goal.trim(),
        onStepFinish:({toolCalls}) => {
            for (const tc of toolCalls) {
               const preview=JSON.stringify(tc.input).slice(0, 160);
               console.log(chalk.blue('✔'),
                chalk.bold(String(tc.toolName)),
                chalk.dim(preview + (preview.length>=160?'...':'')));
            }
        }
    }
  );
}
