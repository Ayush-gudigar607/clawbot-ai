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
    const abs = path.resolve(this.config.codebasePath, rel);
    const root = path.resolve(this.config.codebasePath);
    //codebasePath =D:\clawbot-->and the agent asks for: src/index.ts-->It resolves:D:\clawbot\src\index.ts
    const relcheck = path.relative(root, abs);
    //But imagine the agent tries:../../secret.txt--->That could potentially escape the workspace:D:\clawbot
    if (relcheck.startsWith("..") || path.isAbsolute(relcheck)) {
      throw new Error(`Path escapes workspace: ${rel}`);
    }
    return abs;
  }
}
