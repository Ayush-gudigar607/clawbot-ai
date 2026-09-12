// This file defines the types and interfaces used for agent actions and configurations.
export type ActionType =
  | 'file_create'
  | 'file_modify'
  | 'file_delete'
  | 'folder_create'
  | 'code_analysis'
  | 'tool_execute';


// This type represents the possible statuses of an action performed by the agent.
export type ActionStats='pending' | 'executed' | 'rejected' |'approved'

// The ActionLog interface defines the structure of an action log entry, which includes details about the action performed, its status, and any relevant metadata.
export interface ActionLog{
    id:string,
    timestamp:Date,
    type:ActionType,
    path:string,
    details:{
        before?:string,
        after?:string,
        toolName?:string,
        toolResult?:string,
        error?:string,
        command?:string
    };
    status:ActionStats;
    userApproved?:boolean
}

//function to check if the action is a mutation type
export interface AgentConfig {
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

// This function returns the default configuration for an agent, including the codebase path, maximum file size to read, excluded patterns, and tool permissions.
export const defaultAgentConfig = (): AgentConfig => ({
  //this gives current directory
  codebasePath: process.cwd(),
  maxFileSizeToRead: 1024 * 1024 ,
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
    t === 'tool_execute'
  );
}