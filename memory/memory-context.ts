import {
  MemoryManager,
  type MemoryCandidate,
} from "./supermemory";
import type { MemoryContext } from "./types";

export class AgentMemory {
  private readonly manager: MemoryManager;
  private readonly context: MemoryContext;

  constructor(
    context: MemoryContext,
    manager = new MemoryManager(),
  ) {
    this.manager = manager;
    this.context = context;
  }

  async rememberMany(
    candidates: readonly MemoryCandidate[],
  ): Promise<void> {
    await this.manager.rememberMany(
      this.context,
      candidates,
    );
  }

  async recall(
    query: string,
    limit = 5,
  ) {
    return this.manager.recall(
      this.context,
      query,
      limit,
    );
  }

  async buildContext(
    query: string,
    limit = 5,
  ): Promise<string> {
    return this.manager.buildContext(
      this.context,
      query,
      limit,
    );
  }
}