import {
    Output,
    extractJsonMiddleware,
    generateText,
    stepCountIs,
    tool,
    wrapLanguageModel,
} from "ai";
import { z } from "zod";
import chalk from "chalk";
import {getAgentModel} from "../../ai/ai.config.ts";
import { ActionTracker } from "../agents/action-tracker.ts";
import { ToolExecutor } from "../agents/tool-executor.ts";
import {defaultAgentConfig} from "../agents/types.ts";
import type {Plan,PlanStep} from "./types.ts";
import { createWebTools } from "./web-tools.ts";

  const planSchema = z.object({
  researchSummary: z.string().optional(),

  steps: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        hints: z.array(z.string()).optional(),
        complexity: z
          .enum(["low", "medium", "high"])
          .optional(),
      }),
    )
    .min(1)
    .max(15),
});

function readOnlyTools(executor: ToolExecutor) {
  return {
    read_file: tool({
      description:
        "Read a text file from the workspace. Use a path relative to the project root.",
      inputSchema: z.object({
        path: z.string().describe("Relative file path"),
      }),
      execute: async ({ path: p }) => executor.readFile(p),
    }),

    list_files: tool({
      description: "List files and directories under a path.",
      inputSchema: z.object({
        path: z.string(),
        recursive: z.boolean().optional().default(false),
      }),
      execute: async ({ path: p, recursive }) =>
        executor.listFiles(p, recursive),
    }),

    search_files: tool({
      description:
        'Find files matching a glob pattern (e.g. "*.ts", "**/*.md"). Optional content substring filter.',
      inputSchema: z.object({
        root: z.string().describe("Directory to search, relative to root"),
        pattern: z
          .string()
          .describe("Glob-like pattern using * and ** (forward slashes)"),
        content_contains: z.string().optional(),
      }),
      execute: async ({ root, pattern, content_contains }) =>
        executor.searchFiles(root, pattern, content_contains),
    }),

    analyze_codebase: tool({
      description:
        "Summarize structure: file counts, size, extensions. Read-only.",
      inputSchema: z.object({
        path: z.string().default("."),
      }),
      execute: async ({ path: p }) => executor.analyzeCodebase(p),
    }),

    list_skills: tool({
      description:
        "List absolute paths to SKILL.md files under configured skill directories (Cursor / Claude).",
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
      description:
        "Read a SKILL.md or supporting text resource. Path must be under a skill root, or be returned by a skill discovery tool.",
      inputSchema: z.object({
        path: z.string(),
      }),
      execute: async ({ path: p }) => executor.readSkill(p),
    }),
  };
}

//it will accepts codebase and hasweb
const PLAN_INSTRUCTIONS=(codebase:boolean,hasWeb:boolean)=>
[
    'You are a Plan-Mode planner.You DO NOT modify files.',
     `Workspace:${codebase}`,
     'use read-only tool for codebase/skills research.',
     'Search for a matching skill with search_skills, read its SKILL.md, and call list_skill_resources. Read resources explicitly referenced by the skill or needed for the goal; do not load unrelated resources. Use workspace-task when no specialized skill applies.',
     hasWeb ? 'web tools are available (web_search/web_crawl/fetch_url).use only when needed.':
     'web tools are not available.',
     'output must match the provided JSON schema.',
     'Keep it short 1-10 steps'
].join('\n');

export async function generatePlan(goal:string)
{
  const config=defaultAgentConfig();
  const tracker=new ActionTracker(config.sessionId, config.userId);
  const executor=new ToolExecutor(tracker,config);


  const hashweb=!!process.env.FIRECRAWL_API_KEY || false;
  const model=wrapLanguageModel(
    {
        model:getAgentModel(),
        middleware:extractJsonMiddleware()
    }
  )

  //todo:add web search-tools
  const tools={
    ...readOnlyTools(executor),
    ...(hashweb ? createWebTools(tracker) : {})
  };

  console.log(chalk.cyan("\n Researching and drafting a plan... \n"))


const result = await generateText({
    model,
    tools,
    stopWhen:stepCountIs(20),
    system: PLAN_INSTRUCTIONS(!!config.codebasePath, hashweb),
    prompt:`User goal: \n${goal}`,
    output:Output.object({schema:planSchema})
  });

  const validated=planSchema.parse(result.output);

    const steps:PlanStep[] = validated.steps.map(
      (s: z.infer<typeof planSchema>["steps"][number], i: number) => ({
    id:`step-${i+1}`,
    title:s.title,
    description:s.description,
    hints:s.hints,
    complexity:s.complexity
      }),
    );

  return {
    goal,
    researchSummary:validated.researchSummary,
    steps
  }

}




