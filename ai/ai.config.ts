import { createOpenRouter } from "@openrouter/ai-sdk-provider";

//getmodel function to get the agent using apikey 
export function getAgentModel()
{
    const provider=createOpenRouter({
        apiKey:process.env.OPENROUTER_API_KEY
    });

//get the default model using openrouter
    const modelId=process.env.OPENROUTER_DEFAULT_MODEL;

    if(!modelId)
    {
        throw new Error("OPENROUTER_DEFAULT_MODEL is not set")
    }

    return provider(modelId);


}