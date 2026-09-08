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

  //This function is interesting because it understands the staged state.
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
   if(!fs.existsSync(abs) || !fs.statSync(abs).isFile())
   {
    return undefined;
   }
   return fs.readFileSync(abs,"utf-8");
  }
}

