import chalk from "chalk";
import { select, isCancel } from "@clack/prompts";
import { runAgentMode } from "./agents/orchestrater";
import { runAskMode } from "./ask/orchestrater";
import { runPlanMode } from "./plan/orchestrater";

//function to run the cli
export async function runcliMode() {
  while (true) {
    const mode = await select({
      message: "Choose sub-cli Mode",
      options: [
        { value: "agent", label: "Agent Mode" },
        { value: "plan", label: "Plan Mode" },
        { value: "ask", label: "Ask Mode" },
        {value:"mcp",label:"MCP Mode"},
        { value: "Back", label: "Back to main menu" },
      ],
    });

    if(isCancel(mode) || mode=="Back")
    {
        return;
    }

    if(mode=="agent")
        
    {
        //call the agent mode 
        await runAgentMode();
    }

    if(mode=="plan")
    {
        //call the plan mode
        await runPlanMode();
    }

    if(mode=="ask")
    {
        //call the ask mode
        await runAskMode();
    }
    
    //if not agent and mode is not plan as well as ask then return the method is not implemented 
    if(mode!=='agent' && mode!=='plan' && mode!=='ask')
        {
            console.log(chalk.yellow("\n That mode is not implemented yet.\n"));
            // console.log("")
        }
  }
}
