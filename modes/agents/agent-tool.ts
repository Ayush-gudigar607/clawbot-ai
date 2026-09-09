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

    write_file:tool({
      description:
        "Stage creation of a file by writing its content to the codebase",
      inputSchema: z.object({
        path: z.string().describe("Relative path of the file to write"),
        content: z.string().describe("Content to write to the file"),
      }),
      execute: async ({ path: p, content }) => executor.createFile(p, content),
    })
  };

  modify_file:tool({
            description:"Stage modification of a file with the given content",
            inputSchema:z.object({
                path:z.string().describe("The relative path to the file to modify"),
                content:z.string().describe("The content to write to the file")
            }),
            execute:async({path:p,content:c})=>executor.modifyFile(p,c)
        })
}
