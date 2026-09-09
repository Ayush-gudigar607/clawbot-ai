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
    }),
  

  modify_file:tool({
            description:"Stage modification of a file with the given content",
            inputSchema:z.object({
                path:z.string().describe("The relative path to the file to modify"),
                content:z.string().describe("The content to write to the file")
            }),
            execute:async({path:p,content:c})=>executor.modifyFile(p,c)
        }),

        delete_file:tool({
            description:"Stage deletion of a file",
            inputSchema:z.object({
                path:z.string().describe("The relative path to the file to delete")
            }),
            execute:async({path:p})=>executor.deleteFile(p)
        }),

        create_folder:tool({
            description:"Stage creation of a folder",
            inputSchema:z.object({
              path:z.string().describe("The relative path to the folder to create")
            }),
            execute:async({path:p})=>executor.createFolder(p)
        }),

        list_files:tool({
            description:"List files and directories under a path",
            inputSchema:z.object({
              path:z.string().describe("The relative path to list files and directories under"),
              recursive:z.boolean().optional().describe("Whether to list files recursively").default(false)
            }),
            execute:async({path:p,recursive:r})=>executor.listFiles(p,r)
        }),

        search_files:tool({
          description:'Find files matching a glob pattern (e.g "*.ts", "**/*.md")',
          inputSchema:z.object({
            root:z.string().describe("The root path to search under"),
            pattern:z.string().describe("The glob pattern to match"),
            content_contains:z.string().optional().describe("Optional content query to filter files by content")
          }),
          execute:async({root,pattern,content_contains})=>executor.searchFiles(root,pattern,content_contains) 
        }),

        analyze_codebase:tool({
          description:"Summarize structure:file counts,size,extensions,dependencies, etc. of the codebase",
          inputSchema:z.object({
            root:z.string().describe("The root path of the codebase to analyze")
          }),
          execute:async({root})=>executor.analyzeCodebase(root)
        }),

        execute_shell:tool({
          description:"Queue a shell command to run in the workspace after user approval.use with care",
          inputSchema:z.object({
            command:z.string().describe("The shell command to execute")
          }),
          execute:async({command})=>executor.queueShell(command)
        }),
}
}

