import {MemoryManager,type MemoryContext} from "./supermemory"

export class AgentMemory{
  private readonly manager: MemoryManager;
  private readonly context: MemoryContext;

  constructor(context: MemoryContext) {
    this.manager = new MemoryManager();
    this.context = context;
  }

  async remember(content:string):Promise<void>{
    await this.manager.remember(this.context,content);
  }

  async recall(query:string,limit=5,)
  {
    return this.manager.recall(this.context,query,limit);
  }

  async buildContext(query:string):Promise<string>{
    return this.manager.buildContext(this.context,query);
  }

}