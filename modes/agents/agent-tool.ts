import { z } from "zod";
import { ToolExecutor } from "./tool-executor";
import { tool } from "ai";

export function createToolExecutor(executor: ToolExecutor) {
  return {
    read_file: tool({
      description:
        "Stage creation of a file by reading its content from the codebase",
      inputSchema: z.object({
        path: z.string().describe("Relative path of the file to read"),
      }),
      execute: async ({ path: p }) => executor.readFile(p),
    }),
  };
}
