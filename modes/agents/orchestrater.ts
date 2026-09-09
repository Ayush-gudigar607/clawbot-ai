import { isCancel, text } from "@clack/prompts";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";
import {ToolExecutor} from "./tool-executor";
import { createToolExecutor } from "./agent-tool";
import chalk from "chalk";

export async function runAgentMode()
{
    console.log(chalk.bold("Starting Clawbot AI in Agent mode..."));

const goal=await text({
        message:"What would you like the agent to do?",
        placeholder:"Concreate task for this codebase..."
    })

    if(isCancel(goal) || !goal.trim())
    {
        return;
    }

    const config=defaultAgentConfig();
    const tracker=new ActionTracker();
    const executor=new ToolExecutor(tracker,config);
    const toolExecutor=createToolExecutor(executor);
    }

