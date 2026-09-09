import chalk from "chalk";
import { select, isCancel } from "@clack/prompts";
import { runAgentMode } from "./agents/orchestrater";

export async function runcliMode() {
  while (true) {
    const mode = await select({
      message: "Choose sub-cli Mode",
      options: [
        { value: "agent", label: "Agent Mode" },
        { value: "plan", label: "Plan Mode" },
        { value: "ask", label: "Ask Mode" },
        { value: "Back", label: "Back to main menu" },
      ],
    });

    if(isCancel(mode) || mode=="Back")
    {
        return;
    }

    if(mode=="agent")
    {
        await runAgentMode();
    }

    if(mode=="plan")
    {
        console.log("plan")
    }

    if(mode=="ask")
    {
        console.log("ask")
    }
    
    if(mode!=='agent' && mode!=='plan' && mode!=='ask')
        {
            console.log(chalk.yellow("\n That mode is not implemented yet.\n"));
            // console.log("")
        }
  }
}
