import fs from "node:fs";
import path from "node:path";
import {homedir} from "node:os";
import {spawnSync} from "node:child_process";
import {ActionTracker} from "./action-tracker";
import type {ActionLog,AgentConfig} from "./types";

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
]);

function isProbablyTextFile(filePath: string): boolean {
    const ext=path.extname(filePath).toLowerCase();
    return TEXT_EXT.has(ext) || ext==="";
}
