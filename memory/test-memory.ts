import {AgentMemory} from "../memory/memory-context";


 export async function WithMemoryContext(input:string){

    const memory=new AgentMemory({
        userId:"user1",
        projectId:"project1",
        conversationId:"conversation1"
    })

    const memoryContext=await memory.buildContext(input);
    console.log("Memory context:",memoryContext);

    await memory.remember(input);

    console.log("Memory saved");
    console.log("Memory context:", memoryContext);

    return [
        memoryContext ? `Relavant Memory\n${memoryContext}\n\n` : "",
        input,
    ].filter(Boolean).join("\n\n");
}