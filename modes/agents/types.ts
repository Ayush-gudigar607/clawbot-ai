// This file defines the types and interfaces used for agent actions and configurations.
import { createHash, randomUUID } from "node:crypto";
import { userInfo } from "node:os";
import { env } from "../../src/config/env";

export type ActionType =
  | "file_create"
  | "file_modify"
  | "file_delete"
  | "folder_create"
  | "folder_delete"
  | "tool_execute"
  | "code_analysis"
  | "shell";



// This type represents the possible statuses of an action performed by the agent.
export type ActionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "applied"
  | "failed"
  | "executed";

export type ActionStats = ActionStatus;


  export interface ActionDetails {
  before?: string;
  after?: string;

  command?: string;

  executable?: string;
  args?: string[];

  [key: string]: unknown;
}
// The ActionLog interface defines the structure of an action log entry, which includes details about the action performed, its status, and any relevant metadata.
export interface ActionLog {
  /**
   * Unique ID for this exact action.
   */
  id: string;

  /**
   * Agent execution/session.
   */
  sessionId: string;

  /**
   * User who initiated the action.
   */
  userId: string;

  /**
   * Operation being performed.
   */
  type: ActionType;

  /**
   * Workspace-relative target.
   */
  path: string;

  /**
   * SHA-256 of the original content.
   */
  beforeHash?: string;

  /**
   * SHA-256 of the staged content.
   */
  afterHash?: string;

  /**
   * When this action was created.
   */
  timestamp: Date;

  /**
   * Current approval state.
   */
  status: ActionStatus;

  userApproved?: boolean;

  /**
   * Additional information.
   */
  details: ActionDetails;

  /**
   * When the action was approved.
   */
  approvedAt?: Date;

  /**
   * When the action was applied.
   */
  appliedAt?: Date;

  /**
   * Error information if execution failed.
   */
  error?: string;
}

//function to check if the action is a mutation type
export interface AgentConfig {
  sessionId: string;
  userId: string;
  projectId: string;
  codebasePath: string;
  maxFileSizeToRead: number;
  excludePatterns: string[];
  tools: {
    allowShellExecution: boolean;
    allowFileModification: boolean;
    allowFileCreation: boolean;
    allowFolderCreation: boolean;
  };
}

export type SkillSource = "builtin" | "workspace" | "user-global" | "external";

export interface SkillDescriptor {
  name: string;
  path: string;
  source: SkillSource;
  trusted: boolean;
  version?: string;
  allowedTools?: string[];
  resources?: string[];
}

function defaultUserId(): string {
  const configured = env.CLAWBOT_USER_ID?.trim();
  if (configured) return configured;

  try {
    return `local:${userInfo().username}`;
  } catch {
    return "local:unknown";
  }
}

// This function returns the default configuration for an agent, including identity, codebase path, and tool permissions.
export const defaultAgentConfig = (identity?: {
  sessionId?: string;
  userId?: string;
  projectId?: string;
}): AgentConfig => ({
  sessionId: identity?.sessionId ?? randomUUID(),
  userId: identity?.userId ??defaultUserId(),
  projectId:
    identity?.projectId ??
    env.CLAWBOT_PROJECT_ID ??
    createHash("sha256").update(process.cwd()).digest("hex").slice(0, 24),
  //this gives current directory
  codebasePath: process.cwd(),
  maxFileSizeToRead: env.MAX_FILE_SIZE,
  //dont read this files
  excludePatterns: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '*.log',
    '.env*',
  ],
  tools: {
    allowShellExecution: true,
    allowFileModification: true,
    allowFileCreation: true,
    allowFolderCreation: true,
  },
});

export function isMutationType(t: ActionType): boolean {
  return (
    t === 'file_create' ||
    t === 'file_modify' ||
    t === 'file_delete' ||
    t === 'folder_create' ||
    t === 'folder_delete' ||
    t === 'tool_execute' ||
    t === 'shell'
  );
}
