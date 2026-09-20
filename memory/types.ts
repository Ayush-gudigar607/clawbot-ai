export interface MemoryContext {
  userId: string;
  projectId: string;
  conversationId: string;
}

export interface DurableMemory {
  content: string;
  reason?: string;
  confidence?: number;
}

export interface AgentMemory {
  rememberMany(candidates: readonly DurableMemory[]): Promise<void>;

  recall(
    query: string,
    limit?: number,
  ): Promise<{
    content: string;
    score?: number;
  }[]>;

  buildContext(
    query: string,
  ): Promise<string>;
}