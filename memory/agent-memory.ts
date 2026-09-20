import { AgentMemory } from "./memory-context";
import { logger } from "../src/logger";
import { createMemoryContext, type MemoryCandidate } from "./supermemory";
import type { DurableMemory, MemoryContext } from "./types";
import { env } from "../src/config/env";

const MAX_DURABLE_MEMORIES = 10;
const MAX_MEMORY_LENGTH = 500;

export const DURABLE_MEMORY_INSTRUCTIONS =
  "Only save durable user or project facts when genuinely useful. To request persistence, emit one concise line per fact in the form 'Memory: <fact>'. Never include secrets, credentials, tokens, or raw user prompts.";

function normalizeMemory(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

export function extractDurableMemories(output: string): MemoryCandidate[] {
  const memories: MemoryCandidate[] = [];
  const seen = new Set<string>();

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:durable\s+memory|memory)\s*:\s*(.+?)\s*$/i);
    if (!match) continue;

    const rawContent = match[1];
    if (!rawContent) continue;
    const content = normalizeMemory(rawContent);
    const key = content.toLocaleLowerCase();
    if (
      content.length < 10 ||
      content.length > MAX_MEMORY_LENGTH ||
      seen.has(key) ||
      /(?:api[_ -]?key|password|secret|token|private key)\s*[:=]/i.test(content)
    ) {
      continue;
    }

    seen.add(key);
    memories.push({ content, reason: "Explicitly marked durable memory" });
    if (memories.length >= MAX_DURABLE_MEMORIES) break;
  }

  return memories;
}

export async function withMemoryContext(
  input: string,
  identity: MemoryContext,
) {
  if (!env.SUPERMEMORY_API_KEY) return "";

  try {
    const memory = new AgentMemory(createMemoryContext(identity));
    return await memory.buildContext(input);
  } catch (error) {
    logger.warn("Memory retrieval failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return "";
  }
}

export async function saveDurableMemories(
  output: string,
  identity: MemoryContext,
): Promise<DurableMemorySaveResult> {
  const candidates = extractDurableMemories(output);
  if (candidates.length === 0) return { saved: 0, candidates };
  if (!env.SUPERMEMORY_API_KEY) return { saved: 0, candidates };

  try {
    const memory = new AgentMemory(createMemoryContext(identity));
    await memory.rememberMany(candidates);
    return { saved: candidates.length, candidates };
  } catch (error) {
    logger.warn("Memory persistence failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { saved: 0, candidates };
  }
}

export interface DurableMemorySaveResult {
  saved: number;
  candidates: MemoryCandidate[];
}