import { parseCommand } from "./command-parer";

export interface CommandPolicyResult {
  allowed: boolean;
  reason?: string;
  executable?: string;
  args?: string[];
}

const ALLOWED_COMMANDS = new Set([
  "git",
  "bun",
  "npm",
  "node",
  "ls",
  "pwd",
  "cat",
  "grep",
  "find",
  "mkdir",
]);

const BLOCKED_COMMANDS = new Set([
  "sudo",
  "su",
  "shutdown",
  "reboot",
  "format",
  "diskpart",
  "mkfs",
  "mount",
  "umount",
]);

const BLOCKED_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\brm\s+--no-preserve-root\b/i,

  /\bchmod\s+777\b/i,
  /\bchown\s+.*\/etc/i,

  /\bcurl\b.*\|\s*(bash|sh|zsh)\b/i,
  /\bwget\b.*\|\s*(bash|sh|zsh)\b/i,

  /\|\s*(bash|sh|zsh)\b/i,

  />\s*\/dev\/(sd[a-z]|nvme)/i,

  /\bdd\s+.*\bof=\/dev\//i,

  /\bssh\b.*~\/\.ssh/i,
  /\bcat\b.*~\/\.ssh/i,

  /\bcat\b.*\.env\b/i,
  /\bcat\b.*\.env\./i,

  /\bprintenv\b/i,
  /\benv\b.*(TOKEN|KEY|SECRET|PASSWORD)/i,
];

const BLOCKED_SHELL_OPERATORS = [
  "&&",
  "||",
  ";",
  "|",
  "`",
  "$(",
];

export function checkCommandPolicy(
  command: string,
): CommandPolicyResult {
  const normalized = command.trim();

  if (!normalized) {
    return {
      allowed: false,
      reason: "Command is empty",
    };
  }

  /*
   * Do not allow command chaining.

   * Example:
   *
   * git status && rm -rf /
   */
  for (const operator of BLOCKED_SHELL_OPERATORS) {
    if (normalized.includes(operator)) {
      return {
        allowed: false,
        reason: `Shell operator '${operator}' is not allowed`,
      };
    }
  }

  /*
   * Check dangerous patterns before parsing.
   */
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        allowed: false,
        reason: "Command matches a blocked security pattern",
      };
    }
  }

  let parsed;

  try {
    parsed = parseCommand(normalized);
  } catch (error) {
    return {
      allowed: false,
      reason:
        error instanceof Error
          ? error.message
          : "Unable to parse command",
    };
  }

  if (BLOCKED_COMMANDS.has(parsed.executable)) {
    return {
      allowed: false,
      reason: `Command '${parsed.executable}' is blocked`,
      executable: parsed.executable,
      args: parsed.args,
    };
  }

  if (!ALLOWED_COMMANDS.has(parsed.executable)) {
    return {
      allowed: false,
      reason: `Command '${parsed.executable}' is not in the allowlist`,
      executable: parsed.executable,
      args: parsed.args,
    };
  }

  return {
    allowed: true,
    executable: parsed.executable,
    args: parsed.args,
  };
}