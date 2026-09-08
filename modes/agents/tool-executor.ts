import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { ActionTracker } from "./action-tracker";
import type { ActionLog, AgentConfig } from "./types";

const TEXT_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".css",
  ".html",
  ".yml",
  ".yaml",
  ".toml",
  ".txt",
  ".py",
]);

function isProbablyTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXT.has(ext) || ext === "";
}

export class ToolExecutor {
  //Instead of immediately changing the actual file, the new content goes into:
  private overlay = new Map<string, string>();
  //Keeps track of files that have been staged for deletion.
  private deleted = new Set<string>();
  //./src/index.ts-->./src/index.ts-->src/index.ts(This is useful because Windows and Linux use different path separators. )
  private readonly norm = (rel: string) =>
    path.posix.normalize(rel.split(path.sep).join("/")).replace(/^\.\//, "");

  constructor(
    private readonly tracker: ActionTracker,
    private readonly config: AgentConfig,
  ) {}

  private resolveSafe(rel: string): string {
    //turns a sequence of path segments into a full, absolute file path.
    const abs = path.resolve(this.config.codebasePath, rel);
    //turns a sequence of path segments into a full, absolute file path.
    const root = path.resolve(this.config.codebasePath);
    //codebasePath =D:\clawbot-->and the agent asks for: src/index.ts-->It resolves:D:\clawbot\src\index.ts
    const relcheck = path.relative(root, abs);
    //But imagine the agent tries:../../secret.txt--->That could potentially escape the workspace:D:\clawbot
    if (relcheck.startsWith("..") || path.isAbsolute(relcheck)) {
      throw new Error(`Path escapes workspace: ${rel}`);
    }
    return abs;
  }

  //This checks whether a file is prohibited by configuration
  private excluded(relPath: string): boolean {
    const norm=this.norm(relPath);
    //const segments = ["src", "index.ts"];
    const segments = norm.split("/");
    const base=segments[segments.length - 1] ?? "";

    for(const pat of this.config.excludePatterns)
    {
        if (pat === "*.log" && base.endsWith(".log")) return true;
      if (pat === ".env*" && base.startsWith(".env")) return true;
      if (pat.includes("*")) continue;
      if (segments.includes(pat) || norm === pat || norm.startsWith(`${pat}/`))
        return true;
    }
    return false;
    }

    private assertNotExcluded(relPath: string,op:string): void {
      //if the endpoint like .log or .env it will return true and error part will be run it
        if (this.excluded(relPath)) {
            throw new Error(`Operation ${op} is not allowed on excluded file: ${relPath}`);
        }
  }

  //This function is interesting because it understands the staged state.(this will return the )
  getEffectiveText(rel:string):string | undefined
  {
   const key=this.norm(rel);
   //why this is undefined because the file has been staged for deletion, so it should not be considered as existing anymore.
   if(this.deleted.has(key))
   {
    return undefined;
   }

   if(this.overlay.has(key))
   {
    return this.overlay.get(key);
   }

   // If the file is not in the overlay, we need to read it from the file system.
   const abs=this.resolveSafe(rel);
   //Node.js fs.existsSync() checks if a file or path exists, while fs.statSync() retrieves detailed metadata (like file size or type) and throws an error if the path is missing.
   if(!fs.existsSync(abs) || !fs.statSync(abs).isFile())
   {
    return undefined;
   }
   return fs.readFileSync(abs,"utf-8");
  }

  readFile(rel:string):string
  {
    this.assertNotExcluded(rel,"read_File");
    const content = this.getEffectiveText(rel);
    const abs=this.resolveSafe(rel);
    if(!fs.existsSync(abs) || !fs.statSync(abs).isFile())
    {
      throw new Error(`File not found:${rel}`)
    }
    //it gives metadata about retrive it (file_size and type)
   const st=fs.statSync(abs);
   //if file size is more then reject it and return the error
   if(st.size > this.config.maxFileSizeToRead)
   {
    throw new Error(`File is too large:${rel}`);
   }
   //read the file using path
   const text=fs.readFileSync(abs,"utf-8");
   this.tracker.log({
    type:"code_analysis",
    path:this.norm(rel),
    details:{after:text,toolName:"read_File"},
    status:"executed"
   })
   return text;
  }

  createFile(rel:string,content:string):string{
    if(!this.config.tools.allowFileCreation)
    {
      throw new Error("File creation disabled")
    }

    this.assertNotExcluded(rel,"create_File");
    const key=this.norm(rel);
    const abs=this.resolveSafe(rel);

    if(fs.existsSync(abs) && !this.deleted.has(key))
    {
      throw new Error(`Create_file:already exists:${rel}`)
    }

    this.deleted.delete(key);
    this.overlay.set(key,content);
    this.tracker.log({
      type:"file_create",
      path:key,
      details:{after:content},
      status:"pending"
    })
    return `Stagged new file ${key}`
  }

  modifyFile(rel:string,content:string):string{
    if(!this.config.tools.allowFileModification)
    {
      throw new Error("File creation disabled")
    }
    this.assertNotExcluded(rel,"modify_file");
    
    //this will provide the file content
    const before=this.getEffectiveText(rel);
    if(before === undefined)
    {
      throw new Error(`Modify_file:file not found`);
    }

    const key=this.norm(rel);
    this.overlay.set(key,content);
    this.tracker.log({
      type:"file_modify",
      path:key,
      details:{before,after:content},
      status:"pending"
    });
    return `Staged update: ${key}`
  }
}

