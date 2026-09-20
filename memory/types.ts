export interface MemoryContext {
  userId: string;
  projectId: string;
  conversationId: string;
}

export interface AgentMemory {
   remember(
    content:string
   ):Promise<void>;

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