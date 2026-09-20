import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function getAgentModel() {
  const provider = process.env.AI_PROVIDER ?? "openrouter";

  switch (provider) {
    case "openrouter": {
      const apiKey = process.env.OPENROUTER_API_KEY;

      if (!apiKey) {
        throw new Error(
          "OPENROUTER_API_KEY is not set",
        );
      }

      const openrouter = createOpenRouter({
        apiKey,
      });

      const modelId =
        process.env.OPENROUTER_DEFAULT_MODEL;

      if (!modelId) {
        throw new Error(
          "OPENROUTER_DEFAULT_MODEL is not set",
        );
      }

      return openrouter(modelId);
    }

    case "gemini": {
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY is not set",
        );
      }

      const google = createGoogleGenerativeAI({
        apiKey,
      });

      const modelId =
        process.env.GEMINI_DEFAULT_MODEL ??
        "gemini-2.5-flash";

      return google(modelId);
    }

    default:
      throw new Error(
        `Unsupported AI provider: ${provider}`,
      );
  }
}