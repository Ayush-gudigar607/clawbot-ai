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
    const norm = this.norm(relPath);
    //const segments = ["src", "index.ts"];
    const segments = norm.split("/");
    const base = segments[segments.length - 1] ?? "";

    for (const pat of this.config.excludePatterns) {
      if (pat === "*.log" && base.endsWith(".log")) return true;
      if (pat === ".env*" && base.startsWith(".env")) return true;
      if (pat.includes("*")) continue;
      if (segments.includes(pat) || norm === pat || norm.startsWith(`${pat}/`))
        return true;
    }
    return false;
  }

  private assertNotExcluded(relPath: string, op: string): void {
    //if the endpoint like .log or .env it will return true and error part will be run it
    if (this.excluded(relPath)) {
      throw new Error(
        `Operation ${op} is not allowed on excluded file: ${relPath}`,
      );
    }
  }

  //This function is interesting because it understands the staged state.(this will return the )
  getEffectiveText(rel: string): string | undefined {
    const key = this.norm(rel);
    //why this is undefined because the file has been staged for deletion, so it should not be considered as existing anymore.
    if (this.deleted.has(key)) {
      return undefined;
    }

    if (this.overlay.has(key)) {
      return this.overlay.get(key);
    }

    // If the file is not in the overlay, we need to read it from the file system.
    const abs = this.resolveSafe(rel);
    //Node.js fs.existsSync() checks if a file or path exists, while fs.statSync() retrieves detailed metadata (like file size or type) and throws an error if the path is missing.
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      return undefined;
    }
    return fs.readFileSync(abs, "utf-8");
  }

  readFile(rel: string): string {
    this.assertNotExcluded(rel, "read_File");
    const content = this.getEffectiveText(rel);
    const abs = this.resolveSafe(rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      throw new Error(`File not found:${rel}`);
    }
    //it gives metadata about retrive it (file_size and type)
    const st = fs.statSync(abs);
    //if file size is more then reject it and return the error
    if (st.size > this.config.maxFileSizeToRead) {
      throw new Error(`File is too large:${rel}`);
    }
    //read the file using path
    const text = fs.readFileSync(abs, "utf-8");
    this.tracker.log({
      type: "code_analysis",
      path: this.norm(rel),
      details: { after: text, toolName: "read_File" },
      status: "executed",
    });
    return text;
  }

  createFile(rel: string, content: string): string {
    if (!this.config.tools.allowFileCreation) {
      throw new Error("File creation disabled");
    }

    this.assertNotExcluded(rel, "create_File");
    const key = this.norm(rel);
    const abs = this.resolveSafe(rel);

    if (fs.existsSync(abs) && !this.deleted.has(key)) {
      throw new Error(`Create_file:already exists:${rel}`);
    }

    this.deleted.delete(key);
    this.overlay.set(key, content);
    this.tracker.log({
      type: "file_create",
      path: key,
      details: { after: content },
      status: "pending",
    });
    return `Stagged new file ${key}`;
  }

  modifyFile(rel: string, content: string): string {
    if (!this.config.tools.allowFileModification) {
      throw new Error("File creation disabled");
    }
    this.assertNotExcluded(rel, "modify_file");

    //this will provide the file content
    const before = this.getEffectiveText(rel);
    if (before === undefined) {
      throw new Error(`Modify_file:file not found`);
    }

    const key = this.norm(rel);
    this.overlay.set(key, content);
    this.tracker.log({
      type: "file_modify",
      path: key,
      details: { before, after: content },
      status: "pending",
    });
    return `Staged update: ${key}`;
  }

  deleteFile(rel: string): string {
    if (!this.config.tools.allowFileModification) {
      throw new Error("File deletion failed");
    }

    this.assertNotExcluded(rel, "delete_file");
    const before = this.getEffectiveText(rel);

    if (before === undefined) {
      throw new Error(`delete_file:file not found:${rel}`);
    }
    const key = this.norm(rel);
    this.overlay.delete(key);
    this.deleted.add(key);

    this.tracker.log({
      type: "file_delete",
      path: key,
      details: { before },
      status: "pending",
    });

    return `Stagged delete: ${key}`;
  }

  createFolder(rel: string): string {
    if (!this.config.tools.allowFolderCreation) {
      throw new Error("Folder creation disabled");
    }

    this.assertNotExcluded(rel, "create_folder");
    const key = this.norm(rel);
    this.tracker.log({
      type: "folder_create",
      path: key,
      details: { after: key },
      status: "pending",
    });
    return `Stagged new folder ${key}`;
  }

  listFiles(rel: string, recursive: boolean): string {
    this.assertNotExcluded(rel, "list_files");
    const abs = this.resolveSafe(rel);
    if (!fs.existsSync(abs))
      throw new Error(`list_files:folder not found:${rel}`);

    const lines: string[] = [];
    //dir-it is mainly used for get the directory
    //prefix-it is mainly used for get the prefix of the directory like / or //
    const walk = (dir: string, prefix: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        const relpath = path.relative(this.config.codebasePath, full);
        //suppose  the folder contains the .env file and the agent tries to list all files in the folder, it will skip that file and continue to the next one.
        if (this.excluded(relpath)) continue;
        //wheather it is a directory
        if (ent.isDirectory()) {
          lines.push(`${prefix}${ent.name}/`);
          if (recursive) {
            walk(full, `${prefix}${ent.name}/`);
          }
        } else {
          lines.push(`${prefix}${ent.name}`);
        }
      }
    };

    if (fs.statSync(abs).isDirectory()) walk(abs, "");
    else lines.push(path.relative(this.config.codebasePath, abs));

    const out = lines.sort().join("\n");
    this.tracker.log({
      type: "code_analysis",
      path: this.norm(rel),
      details: { after: out },
      status: "executed",
    });
    return out || "(empty";
  }

  searchFiles(
    rootRel: string,
    globPattern: string,
    contentQuery?: string,
  ): string {
    this.assertNotExcluded(rootRel, "search_files");
    const rootAbs = this.resolveSafe(rootRel);
    if (!fs.existsSync(rootAbs) || !fs.statSync(rootAbs).isDirectory()) {
      throw new Error(`search_files:folder not found:${rootRel}`);
    }

    const results: string[] = [];
    const regexFromGlob = (g: string): RegExp => {
      //This function converts a glob pattern into a regular expression.
      const escaped = g
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "§§")
        .replace(/\*/g, "[^/\\\\]*")
        .replace(/§§/g, ".*")
        .replace(/\?/g, ".");
      return new RegExp(`^${escaped}$`, "i");
    };
    //src\utils\*.ts--->src/utils/*.ts
    const nameRe = regexFromGlob(globPattern.replace(/\\/g, "/"));

    const walk = (dir: string) => {
      //This reads everything inside the directory.
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        const rel = path
          .relative(this.config.codebasePath, full)
          .split(path.sep)
          .join("/");
        if (this.excluded(rel)) continue;
        if (ent.isDirectory()) walk(full);
        else if (nameRe.test(rel)) {
          if (contentQuery && isProbablyTextFile(full)) {
            const text = this.getEffectiveText(rel);
            if (text && !text.includes(contentQuery)) continue;
            const Readtext = fs.readFileSync(full, "utf-8");
            if (!Readtext.includes(contentQuery)) continue;
          }
          results.push(rel);
        }
      }
    };
    if (fs.statSync(rootAbs).isDirectory()) walk(rootAbs);
    else {
      const relP = path
        .relative(this.config.codebasePath, rootAbs)
        .split(path.sep)
        .join("/");
      results.push(relP);
    }
    const out = [...new Set(results)].sort().join("\n");
    this.tracker.log({
      type: "code_analysis",
      path: this.norm(rootRel),
      details: { after: out || "(no matches)", toolName: "search_files" },
      status: "executed",
    });
    return out || "(no matches)";
  }

  analyzeCodebase(rootRel: string): string {
    const rootAbs = this.resolveSafe(rootRel);
    if (!fs.existsSync(rootAbs) || !fs.statSync(rootAbs).isDirectory()) {
      throw new Error(`analyze_codebase:folder not found:${rootRel}`);
    }

    let files = 0;
    let dirs = 0;

    const walk = (dir: string) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        const relip = path.relative(this.config.codebasePath, full);
        if (this.excluded(relip)) continue;
        if (ent.isDirectory()) {
          dirs++;
          walk(full);
        } else {
          files++;
        }
      }
    };

    if (fs.statSync(rootAbs).isDirectory()) walk(rootAbs);
    else files = 1;

    const summary = `Files: ${files} | Directories: ${dirs}`;
    this.tracker.log({
      type: "code_analysis",
      path: this.norm(rootRel),
      details: { after: summary, toolName: "analyze_codebase" },
      status: "executed",
    });
    return summary;
  }

  queueShell(command: string): string {
    if (!this.config.tools.allowShellExecution) {
      throw new Error("Shell execution disabled");
    }
    this.tracker.log({
      type: "tool_execute",
      path:"shell",
      details: { command, toolName: "shell" },
      status: "pending",
  });

    return 'shell queued:${command}';
  }
}
