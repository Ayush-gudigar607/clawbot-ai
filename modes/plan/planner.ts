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
import { logger } from "../../src/logger";
import { env } from "../../src/config/env";

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

const PLAN_INSTRUCTIONS = (codebase: boolean, hasWeb: boolean) =>
  [
    `You are Clawbot AI Plan Architect. Your objective is to formulate a precise, realistic, and actionable implementation plan for the user's goal.`,
    `Workspace Available: ${codebase}. You have read-only tools to inspect the codebase and skills. You DO NOT modify files during planning.`,
    hasWeb
      ? "Web tools are available (web_search, web_crawl, fetch_url). Use them when external library or architectural research is needed."
      : "Web tools are disabled.",
    ``,
    `### Planning Principles:`,
    `1. Codebase Investigation: Use read_file, search_files, and analyze_codebase first to discover existing architecture, patterns, file paths, and dependencies.`,
    `2. Skill Lookup: Call search_skills to find applicable skills or conventions relevant to the goal.`,
    `3. Logical Decomposition: Break the task into 1 to 10 sequential, concrete steps. Each step should be actionable by an automated coding agent.`,
    `4. Step Quality: For each step, include:`,
    `   - A clear, concise title.`,
    `   - Detailed description specifying target files, key changes, and expected outcome.`,
    `   - Practical hints (e.g. function signatures, edge cases, commands to run).`,
    `   - Realistic complexity assessment (low, medium, or high).`,
    `5. Research Summary: Summarize your findings, architecture considerations, and prerequisites in researchSummary.`,
    `6. JSON Schema: Your response must strictly match the provided plan JSON schema.`,
  ].join("\n");

export async function generatePlan(goal:string)
{
  const config=defaultAgentConfig();
  const tracker=new ActionTracker(config.sessionId, config.userId);
  const executor=new ToolExecutor(tracker,config);


  const hashweb=!!env.FIRECRAWL_API_KEY;
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

  logger.info(chalk.cyan("\n Researching and drafting a plan... \n"))


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




