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

//this is for agent memory, which is a more advanced memory system that can be used to store and retrieve memories for agents. It is designed to be used with the Supermemory API.
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