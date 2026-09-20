import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";

import { ActionTracker } from "./action-tracker";
import type { ActionLog, AgentConfig } from "./types";

import {
  checkCommandPolicy,
} from "../../security/command-policy";

import {
  executeSandboxed,
} from "../../security/sandbox";
import { randomUUID } from "node:crypto";

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
}

interface SearchOptions {
  maxResults?: number;
  includeExtensions?: string[];
}

interface SkillInfo {
  name: string;
  path: string;
}

export class ToolExecutor {
  /**
   * Files created/modified by the agent but not yet committed.
   */
  private readonly overlay = new Map<string, string>();

  /**
   * Files deleted by the agent but not yet committed.
   */
  private readonly deleted = new Set<string>();

  /**
   * Normalize workspace-relative paths.
   */
  private readonly norm = (rel: string): string =>
    path.posix
      .normalize(rel.split(path.sep).join("/"))
      .replace(/^\.\/+/, "");

  constructor(
    private readonly tracker: ActionTracker,
    private readonly config: AgentConfig,
  ) {}

  // ============================================================
  // PATH SECURITY
  // ============================================================

  /**
   * Lexically validate a path against the workspace root.
   *
   * This protects against:
   *
   * ../
   * absolute paths
   * path traversal
   */
  private resolveSafe(rel: string): string {
    if (!rel || typeof rel !== "string") {
      throw new Error("Path is required");
    }

    const root = path.resolve(this.config.codebasePath);
    const abs = path.resolve(root, rel);

    const relative = path.relative(root, abs);

    if (
      relative.startsWith("..") ||
      path.isAbsolute(relative)
    ) {
      throw new Error(
        `Path escapes workspace: ${rel}`,
      );
    }

    return abs;
  }

  /**
   * Resolve the real filesystem path and ensure that symlinks
   * cannot escape the workspace.
   *
   * For files/directories that don't exist yet, the nearest
   * existing parent is resolved.
   */
  private async resolveRealSafe(rel: string): Promise<string> {
    const requested = this.resolveSafe(rel);

    const workspaceRoot = path.resolve(
      this.config.codebasePath,
    );

    const realRoot = await fs.promises.realpath(
      workspaceRoot,
    );

    let current = requested;
    const missingParts: string[] = [];

    while (true) {
      try {
        const realCurrent =
          await fs.promises.realpath(current);

        const relative = path.relative(
          realRoot,
          realCurrent,
        );

        if (
          relative.startsWith("..") ||
          path.isAbsolute(relative)
        ) {
          throw new Error(
            `Symlink/path escapes workspace: ${rel}`,
          );
        }

        let result = realCurrent;

        for (let i = missingParts.length - 1; i >= 0; i--) {
          result = path.join(
            result,
            missingParts[i]!,
          );
        }

        const finalRelative = path.relative(
          realRoot,
          result,
        );

        if (
          finalRelative.startsWith("..") ||
          path.isAbsolute(finalRelative)
        ) {
          throw new Error(
            `Path escapes workspace: ${rel}`,
          );
        }

        return result;
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("escapes workspace")
        ) {
          throw error;
        }

        const parent = path.dirname(current);

        if (parent === current) {
          throw new Error(
            `Unable to resolve path safely: ${rel}`,
          );
        }

        missingParts.push(path.basename(current));
        current = parent;
      }
    }
  }

  /**
   * Convert an absolute path into a normalized workspace-relative
   * path.
   */
  private relativeToWorkspace(abs: string): string {
    const root = path.resolve(
      this.config.codebasePath,
    );

    const relative = path.relative(root, abs);

    if (
      relative.startsWith("..") ||
      path.isAbsolute(relative)
    ) {
      throw new Error(
        `Path is outside workspace: ${abs}`,
      );
    }

    return this.norm(relative);
  }

  // ============================================================
  // PROTECTED PATHS
  // ============================================================

  private isProtectedPath(rel: string): boolean {
    const normalized = this.norm(rel);

    const segments = normalized
      .split("/")
      .filter(Boolean);

    if (segments.length === 0) {
      return false;
    }

    const basename = segments.at(-1) ?? "";

    const protectedDirectories = new Set([
      ".git",
      ".ssh",
      ".aws",
      ".gnupg",
      ".config",
      "node_modules",
    ]);

    for (const segment of segments) {
      if (protectedDirectories.has(segment)) {
        return true;
      }
    }

    /**
     * Protect environment and credential files.
     */
    if (
      basename === ".env" ||
      basename.startsWith(".env.")
    ) {
      return true;
    }

    const protectedFiles = new Set([
      ".npmrc",
      ".pypirc",
      ".netrc",
      "id_rsa",
      "id_ed25519",
      "credentials",
      "credentials.json",
    ]);

    if (protectedFiles.has(basename)) {
      return true;
    }

    return false;
  }

  private assertNotProtected(rel: string): void {
    if (this.isProtectedPath(rel)) {
      throw new Error(
        `Protected path cannot be modified: ${rel}`,
      );
    }
  }

  // ============================================================
  // EXCLUDE POLICY
  // ============================================================

  private excluded(rel: string): boolean {
    const normalized = this.norm(rel);

    if (this.isProtectedPath(normalized)) {
      return true;
    }

    const patterns =
      this.config.excludePatterns ?? [];

    for (const pattern of patterns) {
      if (this.matchesPattern(normalized, pattern)) {
        return true;
      }
    }

    return false;
  }

  private assertNotExcluded(rel: string): void {
    if (this.excluded(rel)) {
      throw new Error(
        `Path is excluded: ${rel}`,
      );
    }
  }

  private matchesPattern(
    value: string,
    pattern: string,
  ): boolean {
    const normalizedPattern =
      pattern.replace(/\\/g, "/");

    if (
      normalizedPattern === value
    ) {
      return true;
    }

    if (
      normalizedPattern.endsWith("/**")
    ) {
      const prefix =
        normalizedPattern.slice(0, -3);

      return (
        value === prefix ||
        value.startsWith(`${prefix}/`)
      );
    }

    if (
      normalizedPattern.startsWith("*.")
    ) {
      return value.endsWith(
        normalizedPattern.slice(1),
      );
    }

    if (
      normalizedPattern.startsWith("*")
    ) {
      return value.endsWith(
        normalizedPattern.slice(1),
      );
    }

    return false;
  }

  private globToRegExp(pattern: string): RegExp {
    const escaped = pattern
      .replace(/\\/g, "/")
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "§§")
      .replace(/\*/g, "[^/]*")
      .replace(/§§/g, ".*")
      .replace(/\?/g, ".");

    return new RegExp(`^${escaped}$`, "i");
  }

  // ============================================================
  // FILE HELPERS
  // ============================================================

  private async assertFile(
    abs: string,
  ): Promise<void> {
    const stat = await fs.promises.stat(abs);

    if (!stat.isFile()) {
      throw new Error(
        `Not a file: ${abs}`,
      );
    }
  }

  private async assertDirectory(
    abs: string,
  ): Promise<void> {
    const stat = await fs.promises.stat(abs);

    if (!stat.isDirectory()) {
      throw new Error(
        `Not a directory: ${abs}`,
      );
    }
  }

  private async pathExists(
    abs: string,
  ): Promise<boolean> {
    try {
      await fs.promises.access(abs);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================
  // EFFECTIVE CONTENT
  // ============================================================

  /**
   * Returns the content that the agent currently sees.
   *
   * This includes staged modifications.
   */
  private async getEffectiveText(
    rel: string,
  ): Promise<string | null> {
    const normalized = this.norm(rel);

    if (this.deleted.has(normalized)) {
      return null;
    }

    if (this.overlay.has(normalized)) {
      return this.overlay.get(normalized) ?? "";
    }

    const abs =
      await this.resolveRealSafe(normalized);

    try {
      await this.assertFile(abs);

      return await fs.promises.readFile(
        abs,
        "utf8",
      );
    } catch {
      return null;
    }
  }

  // ============================================================
  // READ FILE
  // ============================================================

  async readFile(rel: string): Promise<string> {
    const normalized = this.norm(rel);

    this.assertNotExcluded(normalized);

    const staged =
      await this.getEffectiveText(normalized);

    if (staged !== null) {
      return staged;
    }

    const abs =
      await this.resolveRealSafe(normalized);

    await this.assertFile(abs);

    return await fs.promises.readFile(
      abs,
      "utf8",
    );
  }

  // ============================================================
  // CREATE FILE
  // ============================================================

  async createFile(
    rel: string,
    content: string,
  ): Promise<string> {
    if (!this.config.tools.allowFileCreation) {
      throw new Error("File creation disabled");
    }

    const normalized = this.norm(rel);

    this.assertNotProtected(normalized);
    this.assertNotExcluded(normalized);

    const abs =
      await this.resolveRealSafe(normalized);

    if ((await this.pathExists(abs)) && !this.deleted.has(normalized)) {
      throw new Error(
        `File already exists: ${normalized}`,
      );
    }

    this.overlay.set(
      normalized,
      content,
    );

    this.deleted.delete(normalized);

    this.tracker.log({
      type: "file_create",
      path: normalized,
      details: {
        after: content,
      },
      status: "pending",
      sessionId: this.config.sessionId,
      userId: this.config.userId
    });

    return `Staged new file: ${normalized}`;
  }

  // ============================================================
  // MODIFY FILE
  // ============================================================

  async modifyFile(
    rel: string,
    content: string,
  ): Promise<string> {
    if (!this.config.tools.allowFileModification) {
      throw new Error("File modification disabled");
    }

    const normalized = this.norm(rel);

    this.assertNotProtected(normalized);
    this.assertNotExcluded(normalized);

    const current =
      await this.getEffectiveText(normalized);

    if (current === null) {
      throw new Error(
        `File does not exist: ${normalized}`,
      );
    }

    this.overlay.set(
      normalized,
      content,
    );

    this.deleted.delete(normalized);

    this.tracker.log({
      type: "file_modify",
      path: normalized,
      details: {
        before: current,
        after: content,
      },
      status: "pending",
      sessionId: this.config.sessionId,
      userId: this.config.userId
    });

    return `Staged update: ${normalized}`;
  }

  // ============================================================
  // DELETE FILE
  // ============================================================

  async deleteFile(
    rel: string,
  ): Promise<string> {
    if (!this.config.tools.allowFileModification) {
      throw new Error("File modification disabled");
    }

    const normalized = this.norm(rel);

    this.assertNotProtected(normalized);
    this.assertNotExcluded(normalized);

    const current =
      await this.getEffectiveText(normalized);

    if (current === null) {
      throw new Error(`File does not exist: ${normalized}`);
    }

    this.deleted.add(normalized);
    this.overlay.delete(normalized);

    this.tracker.log({
      type: "file_delete",
      path: normalized,
      details: {
        before: current ?? "",
      },
      status: "pending",
      sessionId: this.config.sessionId,
      userId: this.config.userId
    });

    return `Staged deletion: ${normalized}`;
  }

  // ============================================================
  // CREATE FOLDER
  // ============================================================

  async createFolder(
    rel: string,
  ): Promise<string> {
    if (!this.config.tools.allowFolderCreation) {
      throw new Error("Folder creation disabled");
    }

    const normalized = this.norm(rel);

    this.assertNotProtected(normalized);
    this.assertNotExcluded(normalized);

    const abs =
      await this.resolveRealSafe(normalized);

    if (await this.pathExists(abs)) {
      throw new Error(
        `Path already exists: ${normalized}`,
      );
    }

    this.tracker.log({
      type: "folder_create",
      path: normalized,
      details: { after: normalized },
      status: "pending",
      sessionId: this.config.sessionId,
      userId: this.config.userId
    });

    return `Staged new folder: ${normalized}`;
  }

  // ============================================================
  // DELETE FOLDER
  // ============================================================

  async deleteFolder(
    rel: string,
  ): Promise<string> {
    const normalized = this.norm(rel);

    this.assertNotProtected(normalized);
    this.assertNotExcluded(normalized);

    const abs =
      await this.resolveRealSafe(normalized);

    if (!(await this.pathExists(abs))) {
      throw new Error(
        `Folder does not exist: ${normalized}`,
      );
    }

    await this.assertDirectory(abs);

    throw new Error("Folder deletion is not supported");
  }

  // ============================================================
  // LIST FILES
  // ============================================================

  async listFiles(
    rel = ".",
    recursive = true,
  ): Promise<string> {
    const normalized =
      rel === "."
        ? ""
        : this.norm(rel);

    if (normalized) {
      this.assertNotExcluded(normalized);
    }

    const root =
      await this.resolveRealSafe(
        normalized || ".",
      );

    await this.assertDirectory(root);

    const output: string[] = [];

    const walk = async (
      current: string,
    ): Promise<void> => {
      const entries =
        await fs.promises.readdir(
          current,
          { withFileTypes: true },
        );

      entries.sort((a, b) =>
        a.name.localeCompare(b.name),
      );

      for (const entry of entries) {
        const absolute =
          path.join(
            current,
            entry.name,
          );

        const relative =
          this.relativeToWorkspace(
            absolute,
          );

        if (this.excluded(relative)) {
          continue;
        }

        /**
         * Never recursively follow symlinks.
         */
        if (entry.isSymbolicLink()) {
          continue;
        }

        if (entry.isDirectory()) {
          output.push(
            `${relative}/`,
          );

          if (recursive) {
            await walk(absolute);
          }
          continue;
        }

        if (entry.isFile()) {
          output.push(relative);
        }
      }
    };

    await walk(root);

    return output.length
      ? output.join("\n")
      : "(empty)";
  }

  // ============================================================
  // SEARCH FILES
  // ============================================================

  async searchFiles(
    rel = ".",
    pattern = "**/*",
    contentQuery?: string,
  ): Promise<string> {
    const normalizedRoot =
      rel === "."
        ? ""
        : this.norm(rel);

    const maxResults = 50;
    const glob = this.globToRegExp(pattern);

    const root =
      await this.resolveRealSafe(
        normalizedRoot || ".",
      );

    await this.assertDirectory(root);

    const results: string[] = [];

    const walk = async (
      current: string,
    ): Promise<void> => {
      if (
        results.length >= maxResults
      ) {
        return;
      }

      const entries =
        await fs.promises.readdir(
          current,
          { withFileTypes: true },
        );

      for (const entry of entries) {
        if (
          results.length >= maxResults
        ) {
          return;
        }

        const absolute =
          path.join(
            current,
            entry.name,
          );

        const relative =
          this.relativeToWorkspace(
            absolute,
          );

        if (this.excluded(relative)) {
          continue;
        }

        /**
         * Do not follow symbolic links.
         */
        if (entry.isSymbolicLink()) {
          continue;
        }

        if (entry.isDirectory()) {
          await walk(absolute);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        if (!glob.test(relative)) continue;

        /**
         * IMPORTANT:
         *
         * Search the effective staged content,
         * not only the content on disk.
         */
        const text =
          await this.getEffectiveText(
            relative,
          );

        if (
          text === null ||
          (contentQuery !== undefined && !text.includes(contentQuery))
        ) {
          continue;
        }

        results.push(relative);
      }
    };

    await walk(root);

    return results.length
      ? results.join("\n")
      : "(no matches)";
  }

  // ============================================================
  // ANALYZE CODEBASE
  // ============================================================

  async analyzeCodebase(_rel = "."): Promise<string> {
    const files =
      await this.listFiles(".");

    const lines =
      files === "(empty)"
        ? []
        : files.split("\n");

    const extensions =
      new Map<string, number>();

    for (const file of lines) {
      const ext =
        path.extname(file)
          .toLowerCase() || "[no extension]";

      extensions.set(
        ext,
        (extensions.get(ext) ?? 0) + 1,
      );
    }

    const extensionSummary =
      [...extensions.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(
          ([extension, count]) =>
            `${extension}: ${count}`,
        )
        .join("\n");

    return [
      "Codebase analysis",
      "=================",
      "",
      `Workspace: ${this.config.codebasePath}`,
      `Files: ${lines.length}`,
      "",
      "Extensions:",
      extensionSummary || "(none)",
    ].join("\n");
  }

  // ============================================================
  // SHELL COMMAND
  // ============================================================

  /**
   * Queue a shell command for approval.
   *
   * IMPORTANT:
   *
   * The command is checked BEFORE it reaches the tracker.
   */
  async queueShell(
    command: string,
  ): Promise<string> {
    const policy =
      checkCommandPolicy(command);

    if (!policy.allowed) {
      throw new Error(
        `Command blocked by security policy: ${policy.reason}`,
      );
    }

    if (!this.config.tools.allowShellExecution) {
      throw new Error("Shell execution disabled");
    }

    this.tracker.log({
      type: "tool_execute",
      path: "shell",
      details: {
        command,
        toolName: "shell",
      },
      status: "pending",
      sessionId: this.config.sessionId,
      userId: this.config.userId
    });

    return `Shell command queued: ${command}`;
  }

  // ============================================================
  // APPLY APPROVED ACTIONS
  // ============================================================

  /**
   * Apply actions that have been approved by the user.
   *
   * IMPORTANT:
   *
   * The security policy is checked AGAIN here.
   *
   * Never assume that something being approved earlier means
   * it is safe to execute now.
   */
  async applyApprovedFromTracker(): Promise<{ errors: string[] }> {
    const actions = this.tracker.getActions().filter(
      (action) => action.status === "approved",
    );
    const errors: string[] = [];

    for (const action of actions) {
      try {
        switch (action.type) {
          case "file_create": {
            await this.applyCreateFile(action);
            break;
          }

          case "file_modify": {
            await this.applyModifyFile(action);
            break;
          }

          case "file_delete": {
            await this.applyDeleteFile(action);
            break;
          }
          

          case "folder_create": {
            await this.applyCreateFolder(action);
            break;
          }

          case "tool_execute": {
            await this.applyShell(action);
            break;  
          }

          default:
            throw new Error(
              `Unsupported action type: ${action.type}`,
            );
        }

        this.tracker.updateStatus(action.id, "applied");

      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        this.tracker.updateStatus(action.id, "failed", undefined, message);
        errors.push(`Failed to apply '${action.path}': ${message}`);
      }
    }

    return { errors };
  }

  // ============================================================
  // APPLY FILE ACTIONS
  // ============================================================

  private async applyCreateFile(
    action: ActionLog,
  ): Promise<void> {
    const rel =
      this.norm(action.path);

    this.assertNotProtected(rel);
    this.assertNotExcluded(rel);

    const target =
      await this.resolveRealSafe(rel);

    if (await this.pathExists(target)) {
      throw new Error(
        `Cannot create existing file: ${rel}`,
      );
    }

    await fs.promises.mkdir(
      path.dirname(target),
      {
        recursive: true,
      },
    );

    await fs.promises.writeFile(
      target,
      action.details?.after ?? "",
      "utf8",
    );
  }

  private async applyModifyFile(
    action: ActionLog,
  ): Promise<void> {
    const rel =
      this.norm(action.path);

    this.assertNotProtected(rel);
    this.assertNotExcluded(rel);

    const target =
      await this.resolveRealSafe(rel);

    await this.assertFile(target);

    /**
     * Verify that the current content is still the
     * content that was approved.
     *
     * This prevents applying an old approval over a
     * file that changed after approval.
     */
    const current =
      await fs.promises.readFile(
        target,
        "utf8",
      );

    const expectedBefore =
      action.details?.before;

    if (
      typeof expectedBefore === "string" &&
      current !== expectedBefore
    ) {
      throw new Error(
        `File changed after approval: ${rel}`,
      );
    }

    await fs.promises.writeFile(
      target,
      action.details?.after ?? "",
      "utf8",
    );
  }

  private async applyDeleteFile(
    action: ActionLog,
  ): Promise<void> {
    const rel =
      this.norm(action.path);

    this.assertNotProtected(rel);
    this.assertNotExcluded(rel);

    const target =
      await this.resolveRealSafe(rel);

    if (!(await this.pathExists(target))) {
      return;
    }

    await this.assertFile(target);

    /**
     * Optional approval consistency check.
     */
    const expectedBefore =
      action.details?.before;

    if (
      typeof expectedBefore === "string"
    ) {
      const current =
        await fs.promises.readFile(
          target,
          "utf8",
        );

      if (current !== expectedBefore) {
        throw new Error(
          `File changed after approval: ${rel}`,
        );
      }
    }

    await fs.promises.unlink(target);
  }

  private async applyCreateFolder(
    action: ActionLog,
  ): Promise<void> {
    const rel =
      this.norm(action.path);

    this.assertNotProtected(rel);
    this.assertNotExcluded(rel);

    const target =
      await this.resolveRealSafe(rel);

    if (await this.pathExists(target)) {
      throw new Error(
        `Folder already exists: ${rel}`,
      );
    }

    await fs.promises.mkdir(
      target,
      {
        recursive: true,
      },
    );
  }

  private async applyDeleteFolder(
    action: ActionLog,
  ): Promise<void> {
    const rel =
      this.norm(action.path);

    this.assertNotProtected(rel);
    this.assertNotExcluded(rel);

    /**
     * Never allow deleting workspace root.
     */
    if (!rel) {
      throw new Error(
        "Deleting workspace root is forbidden",
      );
    }

    const target =
      await this.resolveRealSafe(rel);

    if (!(await this.pathExists(target))) {
      return;
    }

    await this.assertDirectory(target);

    await fs.promises.rm(
      target,
      {
        recursive: true,
        force: false,
      },
    );
  }

  // ============================================================
  // APPLY SHELL
  // ============================================================

  private async applyShell(
    action: ActionLog,
  ): Promise<void> {
    const command =
      action.details?.command ??
      action.path;

    if (
      typeof command !== "string" ||
      !command.trim()
    ) {
      throw new Error(
        "Invalid shell command",
      );
    }

    /**
     * SECURITY:
     *
     * Re-check the command at execution time.
     */
    const policy =
      checkCommandPolicy(command);

    if (!policy.allowed) {
      throw new Error(
        `Command blocked by security policy: ${policy.reason}`,
      );
    }

    if (
      !policy.executable ||
      !policy.args
    ) {
      throw new Error(
        "Command policy did not produce executable/arguments",
      );
    }

    const result =
      await executeSandboxed(
        policy.executable,
        policy.args,
        {
          cwd: this.config.codebasePath,

          /**
           * Maximum execution time.
           */
          timeoutMs: 60_000,

          /**
           * Maximum captured output.
           */
          maxOutputBytes:
            2 * 1024 * 1024,
        },
      );

    if (result.timedOut) {
      throw new Error(
        `Command timed out after 60 seconds: ${command}`,
      );
    }

    if (result.exitCode !== 0) {
      const stderr =
        result.stderr.trim();

      throw new Error(
        [
          `Command failed with exit code ${result.exitCode}`,
          stderr
            ? `stderr: ${stderr}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
  }

  // ============================================================
  // STAGING MANAGEMENT
  // ============================================================

  clearStaging(): void {
    this.overlay.clear();
    this.deleted.clear();
  }

  getStagedFiles(): string[] {
    return [
      ...new Set([
        ...this.overlay.keys(),
        ...this.deleted,
      ]),
    ].sort();
  }

  getStagedContent(
    rel: string,
  ): string | null {
    const normalized =
      this.norm(rel);

    if (this.deleted.has(normalized)) {
      return null;
    }

    return (
      this.overlay.get(normalized) ??
      null
    );
  }

  // ============================================================
  // SKILLS
  // ============================================================

  private skillRoots(): string[] {
    return [
      path.join(
        this.config.codebasePath,
        "skills",
      ),

      ...(process.env.SKILLS_DIRS?.split(";")
        .map((item) => item.trim())
        .filter(Boolean) ?? []),

      path.join(
        homedir(),
        ".cursor",
        "skills",
      ),

      path.join(
        homedir(),
        ".claude",
        "skills",
      ),
    ];
  }

  async listSkills(): Promise<string> {
    const skills: string[] = [];

    for (const root of this.skillRoots()) {
      if (!(await this.pathExists(root))) {
        continue;
      }

      const walk = async (current: string): Promise<void> => {
        const entries = await fs.promises.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isSymbolicLink()) continue;
          const target = path.join(current, entry.name);
          if (entry.isDirectory()) await walk(target);
          else if (entry.isFile() && entry.name === "SKILL.md") skills.push(target);
        }
      };

      try { await walk(root); } catch { continue; }
    }

    return skills.sort().join("\n") || "(none)";
  }

  private async isInsideSkillRoot(
    target: string,
  ): Promise<boolean> {
    const realTarget =
      await fs.promises.realpath(target);

    for (const root of this.skillRoots()) {
      try {
        const realRoot =
          await fs.promises.realpath(root);

        const relative =
          path.relative(
            realRoot,
            realTarget,
          );

        if (
          !relative.startsWith("..") &&
          !path.isAbsolute(relative)
        ) {
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  private resolveSkillFile(skillPath: string): string {
    const skillFile = path.resolve(this.config.codebasePath, skillPath);
    if (path.basename(skillFile) !== "SKILL.md") {
      throw new Error("Skill path must reference a SKILL.md file");
    }
    return skillFile;
  }

  async readSkill(skillPath: string): Promise<string> {
    const skillFile = this.resolveSkillFile(skillPath);

    if (
      !(await this.isInsideSkillRoot(
        skillFile,
      ))
    ) {
      throw new Error(
        "Skill path escapes skill root",
      );
    }

    return fs.promises.readFile(skillFile, "utf8");
  }

  async listSkillResources(skillPath: string): Promise<string> {
    const skillFile = this.resolveSkillFile(skillPath);
    if (!(await this.isInsideSkillRoot(skillFile))) {
      throw new Error("Skill path escapes skill root");
    }
    const skillDir = path.dirname(skillFile);

    const resources: string[] = [];

    const walk = async (
      current: string,
    ): Promise<void> => {
      const entries =
        await fs.promises.readdir(
          current,
          {
            withFileTypes: true,
          },
        );

      for (const entry of entries) {
        if (entry.isSymbolicLink()) {
          continue;
        }

        const absolute =
          path.join(
            current,
            entry.name,
          );

        if (entry.isDirectory()) {
          await walk(absolute);
          continue;
        }

        if (entry.isFile()) {
          resources.push(
            path.relative(
              skillDir,
              absolute,
            ).split(path.sep).join("/"),
          );
        }
      }
    };

    for (const name of ["resources", "references", "scripts", "assets"]) {
      const resourceDir = path.join(skillDir, name);
      if (await this.pathExists(resourceDir)) await walk(resourceDir);
    }

    return resources.length
      ? resources.sort().join("\n")
      : "(no resources)";
  }

  async searchSkills(query: string): Promise<string> {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) throw new Error("search_skills: query is required");
    const paths = (await this.listSkills()).split("\n").filter((item) => item !== "(none)");
    const matches: string[] = [];
    for (const skillFile of paths) {
      const content = await fs.promises.readFile(skillFile, "utf8");
      if (terms.every((term) => content.toLowerCase().includes(term))) matches.push(skillFile);
    }
    return matches.sort().join("\n") || "(no matches)";
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  async exists(
    rel: string,
  ): Promise<boolean> {
    const normalized =
      this.norm(rel);

    this.assertNotExcluded(normalized);

    try {
      const abs =
        await this.resolveRealSafe(
          normalized,
        );

      return await this.pathExists(abs);
    } catch {
      return false;
    }
  }

  async isDirectory(
    rel: string,
  ): Promise<boolean> {
    const normalized =
      this.norm(rel);

    this.assertNotExcluded(normalized);

    try {
      const abs =
        await this.resolveRealSafe(
          normalized,
        );

      const stat =
        await fs.promises.stat(abs);

      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async isFile(
    rel: string,
  ): Promise<boolean> {
    const normalized =
      this.norm(rel);

    this.assertNotExcluded(normalized);

    try {
      const abs =
        await this.resolveRealSafe(
          normalized,
        );

      const stat =
        await fs.promises.stat(abs);

      return stat.isFile();
    } catch {
      return false;
    }
  }
}
