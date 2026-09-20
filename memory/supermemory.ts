import supermemory from "supermemory";
import { createHash } from "node:crypto";
import type { DurableMemory, MemoryContext } from "./types";
import { env } from "../src/config/env";

export interface MemoryResult
{
    id?:string;
    content?:string;
    score?:number;

}

export type MemoryCandidate = DurableMemory;

const MAX_MEMORY_LENGTH = 500;

function isSafeMemory(content: string): boolean {
  return (
    content.length >= 10 &&
    content.length <= MAX_MEMORY_LENGTH &&
    !/(?:api[_ -]?key|password|secret|token|private key)\s*[:=]/i.test(content)
  );
}

export function createMemoryContext(input: MemoryContext): MemoryContext {
  for (const [key, value] of Object.entries(input)) {
    if (!value || typeof value !== "string" || !value.trim()) {
      throw new Error(`Invalid memory context: ${key}`);
    }
  }

  return {
    userId: input.userId.trim(),
    projectId: input.projectId.trim(),
    conversationId: input.conversationId.trim(),
  };
}

export class MemoryManager{
    private readonly client: supermemory;

    constructor(apiKey=env.SUPERMEMORY_API_KEY || "") {
      if (!apiKey) {
        throw new Error("SUPERMEMORY_API_KEY is not set in the environment variables.");
      }

      this.client = new supermemory({ apiKey });
    }

// Creates a stable memory namespace.
//ex:user:123:project:clawbot-ai

private containerTag(context: MemoryContext): string {
    const namespacePart = (value: string) =>
      createHash("sha256").update(value).digest("hex").slice(0, 32);

    // Durable memories span conversations within the same project.
    return `clawbot:v2:user:${namespacePart(context.userId)}:project:${namespacePart(context.projectId)}`;
}

/*save useful information to memory*/

async remember(
    context: MemoryContext,
    content: string,
  ): Promise<void> {
    const normalized = content.replace(/\s+/g, " ").trim();
    if (!isSafeMemory(normalized)) return;

    const safeContext = createMemoryContext(context);

    await this.client.add({
      content: normalized,
      containerTag: this.containerTag(safeContext),
    });
  }

   async rememberMany(
    context: MemoryContext,
    candidates: readonly MemoryCandidate[],
  ): Promise<void> {
    const seen = new Set<string>();
    const valid = candidates
      .map((candidate) => ({
        content: candidate.content?.replace(/\s+/g, " ").trim() ?? "",
        reason: candidate.reason?.trim(),
        confidence: candidate.confidence,
      }))
      .filter((candidate) => {
        const key = candidate.content.toLocaleLowerCase();
        if (!isSafeMemory(candidate.content) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    for (const candidate of valid) {
      await this.remember(context, candidate.content);
    }
  }



/**
 * Search relavant memories based on the query and return the top results.
 */

async recall(
    context: MemoryContext,
    query: string,
    limit = 5,
  ): Promise<MemoryResult[]> {
    if (!query.trim()) return [];

    const safeContext = createMemoryContext(context);

    const safeLimit = Math.max(1, Math.min(limit, 20));

    const result = await this.client.search({
      q: query.trim(),
      containerTag: this.containerTag(safeContext),
      searchMode: "memories",
    });

    const results = Array.isArray(result?.results)
      ? result.results
      : [];

    return results.slice(0, safeLimit).map((item: any) => ({
      id: item.id,
      content:
        item.memory ??
        item.content ??
        item.text ??
        "",
      score:
        item.score ??
        item.similarity,
    }));
  }

/**
   * Get the user's/project's standing profile.
   */
  async profile(
    context: MemoryContext,
  ): Promise<unknown> {
    const safeContext = createMemoryContext(context);

    return this.client.profile({
      containerTag: this.containerTag(safeContext),
    });
  }

  async buildContext(
    context: MemoryContext,
    query: string,
    limit = 5,
  ): Promise<string> {
    const memories = await this.recall(
      context,
      query,
      limit,
    );

    if (memories.length === 0) {
      return "";
    }

    return [
      "## Relevant Long-Term Memory",
      "",
      ...memories
        .filter((memory) => memory.content?.trim())
        .map(
          (memory, index) =>
            `${index + 1}. ${memory.content}`,
        ),
      "",
      "Use these memories only when relevant to the current task.",
    ].join("\n");
  }
}
