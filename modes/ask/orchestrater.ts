import chalk from "chalk";
import { confirm, isCancel, text } from "@clack/prompts";
import { ToolLoopAgent, stepCountIs, tool, type LanguageModel } from "ai";
import { z } from "zod";
import { getAgentModel } from "../../ai";
import { ActionTracker } from "../agents/action-tracker";
import { ToolExecutor } from "../agents/tool-executor";
import { defaultAgentConfig } from "../agents/types";
import { renderTerminalMarkdown, logToolCall } from "../../terminalui/terminal-md";
import { runApprovalFlow } from "../agents/approval";
import { createWebTools } from "../plan/web-tools";
import {
  DURABLE_MEMORY_INSTRUCTIONS,
  saveDurableMemories,
  withMemoryContext,
} from "../../memory/agent-memory";
import { randomUUID } from "node:crypto";
import { logger } from "../../src/logger";
import { env } from "../../src/config/env";

function createAskTools(executor: ToolExecutor) {
  return {
    read_file: tool({
      description:
        "Read the content of an existing file in the workspace by its relative path.",
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

    search_skills: tool({
      description:
        "Find relevant SKILL.md files by skill name, description, or instructions. Returns matching skill names, paths, and descriptions; use read_skill to load one.",
      inputSchema: z.object({
        query: z.string().describe("Task, technology, or capability to find, for example 'docker'"),
      }),
      execute: async ({ query }) => executor.searchSkills(query),
    }),

    list_skill_resources: tool({
      description:
        "List a selected skill's supporting resources, references, scripts, and assets. Read relevant text resources with read_skill; do not execute scripts or use assets unless the task calls for them.",
      inputSchema: z.object({
        path: z.string().describe("Path to the selected SKILL.md"),
      }),
      execute: async ({ path: p }) => executor.listSkillResources(p),
    }),

    read_skill: tool({
      description: "Read the content of a SKILL.md or a supporting text resource under a skill root",
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
    logger.info(chalk.bold("\n Ask Mode\n"))

    const question=await text({
        message:"What do you want to ask the agent?"
    })

    if(isCancel(question) || !question.trim()) return

    const sessionId = randomUUID();
    const userId = env.CLAWBOT_USER_ID ?? "local-user";

    const config=defaultAgentConfig({
sessionId,
userId
    })

    config.tools.allowFileCreation=true
    config.tools.allowShellExecution=false
    config.tools.allowFileModification=false
    config.tools.allowFolderCreation=false

    const tracker=new ActionTracker(sessionId,userId)
    const executor=new ToolExecutor(tracker,config)
    
    //TODO:web-search tool(firecrawl)
    const tools={
        ...createAskTools(executor),
        ...createWebTools(tracker),
    }

    const agent=new ToolLoopAgent({
    model: getAgentModel() as unknown as LanguageModel,
        stopWhen:stepCountIs(20),
        instructions: [
          `You are Clawbot AI in Ask Mode—an expert software architect and codebase researcher.`,
          `Workspace Root: ${config.codebasePath}`,
          ``,
          `### Guidelines:`,
          `1. Codebase Grounding: Always base answers on the actual codebase. Use search_files, read_file, list_files, and analyze_codebase to locate exact file paths, implementations, and configurations before answering.`,
          `2. Read-Only Context: You are in an advisory mode. Focus on clear explanations, architectural insights, and actionable guidance.`,
          `3. Web Tools: If the question requires external library knowledge, latest documentation, or external APIs, use web_search, web_crawl, or fetch_url.`,
          `4. Skills Reference: Check relevant skills using search_skills and read SKILL.md when appropriate.`,
          `5. Structure & Clarity: Format answers using clean markdown with code snippets, relative file paths, and diagrams (in mermaid markdown) when helpful.`,
          `6. Durable Memory: ${DURABLE_MEMORY_INSTRUCTIONS}`,
        ].join("\n"),
        tools
    })


    const memoryIdentity = {
      userId,
      projectId: config.projectId,
      conversationId: sessionId,
    };
    const memoryContext=await withMemoryContext(question.trim(), memoryIdentity);
    
    const result = await agent.generate({
      prompt: [memoryContext, question.trim()].filter(Boolean).join("\n\n"),
      onStepFinish: ({ toolCalls }) => {
        for (const tc of toolCalls) {
          logToolCall(String(tc.toolName), tc.input);
        }
      },
    });

    const answer = result.text?.trim() || "(no answer)";
    console.log("\n" + renderTerminalMarkdown(answer) + "\n");
    await saveDurableMemories(result.text ?? "", memoryIdentity);

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

  await executor.applyApprovedFromTracker()
  executor.clearStaging()
}
