import supermemory from "supermemory";

export interface MemoryContext {
    userId: string;
    projectId: string;
    conversationId: string;
}

export interface MemoryResult
{
    id?:string;
    content?:string;
    score?:number;

}

export class MemoryManager{
    private readonly client: supermemory;

    constructor(apiKey=process.env.SUPERMEMORY_API_KEY || "") {
        if(!apiKey) {
            throw new Error("SUPERMEMORY_API_KEY is not set in the environment variables.");
        }

        this.client = new supermemory({
            apiKey: apiKey,
        });
    }

// Creates a stable memory namespace.
//ex:user:123:project:clawbot-ai

private containerTag(context: MemoryContext): string {
    return `clawbot:user:${context.userId}:project:${context.projectId}`;
}

/*save useful information to memory*/

async remember(context: MemoryContext, content: string): Promise<void> {

    if(!content.trim())
    {
        return;
    }

    await this.client.add({
        content: content,
        containerTag:this.containerTag(context),
    })
}

/**
 * Search relavant memories based on the query and return the top results.
 */

async recall(context:MemoryContext,query:string,limit=5):Promise<MemoryResult[]>{

    if(!query.trim())
    {
        return [];
    }


    const result=await this.client.search({
        q:query,
        containerTag:this.containerTag(context),
        searchMode:"memories",
    });

    const results=Array.isArray(result?.results)?result.results:[];

    return results.slice(0,limit).map((item:any)=>({
        id:item.id,
        content:
        item.memory ?? item.content ?? item.text ?? "",
        score:item.score ?? item.similarity
    }))
}

/**
   * Get the user's/project's standing profile.
   */
  async profile(
    context: MemoryContext,
  ): Promise<unknown> {
    return this.client.profile({
      containerTag: this.containerTag(context),
    });
  }

  async buildContext(
    context:MemoryContext,
    query:string,
  ):Promise<string>{
 const memories=await this.recall(context,query,5);

    if(memories.length===0)
    {
        return "";
    }

   return [
      "## Relevant Long-Term Memory",
      "",
      ...memories
        .filter((memory) => memory.content)
        .map(
          (memory, index) =>
            `${index + 1}. ${memory.content}`,
        ),
      "",
      "Use these memories only when relevant to the current task.",
    ].join("\n");
  }
}
