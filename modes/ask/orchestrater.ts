import chalk from "chalk";
import { confirm, isCancel, text } from "@clack/prompts";
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";
import { getAgentModel } from "../../ai";
import { ActionTracker } from "../agents/action-tracker";
import { ToolExecutor } from "../agents/tool-executor";
import { defaultAgentConfig } from "../agents/types";
import { renderTerminalMarkdown } from "../../terminalui/terminal-md";
import { runApprovalFlow } from "../agents/approval";
import { createWebTools } from "../plan/web-tools";

function createAskTools(executor: ToolExecutor) {
  return {
    read_file: tool({
      description:
        "Stage creation of a file by reading its content from the codebase",
      inputSchema: z.object({
        path: z.string().describe("Relative path of the file to read"),
      }),
      execute: async ({ path: p }) => executor.readFile(p),
    }),

    list_files: tool({
      description: "List files and directories under a path",
      inputSchema: z.object({
        path: z
          .string()
          .describe("The relative path to list files and directories under"),
        recursive: z
          .boolean()
          .optional()
          .describe("Whether to list files recursively")
          .default(false),
      }),
      execute: async ({ path: p, recursive: r }) => executor.listFiles(p, r),
    }),

    search_files: tool({
      description: 'Find files matching a glob pattern (e.g "*.ts", "**/*.md")',
      inputSchema: z.object({
        root: z.string().describe("The root path to search under"),
        pattern: z.string().describe("The glob pattern to match"),
        content_contains: z
          .string()
          .optional()
          .describe("Optional content query to filter files by content"),
      }),
      execute: async ({ root, pattern, content_contains }) =>
        executor.searchFiles(root, pattern, content_contains),
    }),

    analyze_codebase: tool({
      description:
        "Summarize structure:file counts,size,extensions,dependencies, etc. of the codebase",
      inputSchema: z.object({
        root: z.string().describe("The root path of the codebase to analyze"),
      }),
      execute: async ({ root }) => executor.analyzeCodebase(root),
    }),

    list_skills: tool({
      description: "List all skills in the codebase",
      inputSchema: z.object({}),
      execute: async () => executor.listSkills(),
    }),

    read_skill: tool({
      description: "Read the content of a skill file",
      inputSchema: z.object({
        path: z
          .string()
          .describe("The relative path to the skill file to read"),
      }),
      execute: async ({ path: p }) => executor.readSkill(p),
    }),
  };
}

function asMd(question: string, answer: string): string {
  return `# Ask Mode\n\n## Question\n\n${question.trim()}\n\n## Answer\n\n${answer.trim()}\n`;
}


export async function runAskMode()
{
    console.log(chalk.bold("\n Ask Mode\n"))

    const question=await text({
        message:"What do you want to ask the agent?"
    })

    if(isCancel(question) || !question.trim()) return

    const config=defaultAgentConfig()

    config.tools.allowFileCreation=true
    config.tools.allowShellExecution=false
    config.tools.allowFileModification=false
    config.tools.allowFolderCreation=false

    const tracker=new ActionTracker()
    const executor=new ToolExecutor(tracker,config)
    
    //TODO:web-search tool(firecrawl)
    const tools={
        ...createAskTools(executor),
        ...createWebTools(tracker),
    }

    const agent=new ToolLoopAgent({
        model:getAgentModel(),
        stopWhen:stepCountIs(20),
        tools
    })

    const result=await agent.generate({
        prompt:question.trim()

    })

    const answer=result.text?.trim() || "(no answer)"
    console.log("\n"+renderTerminalMarkdown(answer)+"\n")

    const wantSave=await confirm({
        message:"save the answer to a .md file in the current directory? ",
        initialValue:false,
    })

    if(isCancel(wantSave) || !wantSave) return

    const filename = await text({
    message:"Filename",
    initialValue:"ask.md",
     validate: (v) => {
      const s = (v ?? '').trim();
      if (!s) return 'Required';
      if (s.includes('..') || s.includes('/') || s.includes('\\')) return 'No paths';
      if (!s.toLowerCase().endsWith('.md')) return 'Must end with .md';
    },
  })
 
  if(!filename || isCancel(filename)) return;

  executor.createFile(filename.trim(), asMd(question,answer))

  const ok=await runApprovalFlow(tracker)
  if(!ok) return executor.clearStaging();

  executor.applyApprovedFromTracker()
  executor.clearStaging()
}
