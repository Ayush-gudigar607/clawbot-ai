import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "../src/config/env";

export function getAgentModel() {
  const provider = env.AI_PROVIDER;

  switch (provider) {
    case "openrouter": {
      const apiKey = env.OPENROUTER_API_KEY;

      if (!apiKey) {
        throw new Error(
          "OPENROUTER_API_KEY is not set",
        );
      }

      const openrouter = createOpenRouter({
        apiKey,
      });

      const modelId =
        env.OPENROUTER_DEFAULT_MODEL;

      if (!modelId) {
        throw new Error(
          "OPENROUTER_DEFAULT_MODEL is not set",
        );
      }

      return openrouter(modelId);
    }

    case "gemini": {
      const apiKey = env.GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY is not set",
        );
      }

      const google = createGoogleGenerativeAI({
        apiKey,
      });

      const modelId =
        env.GEMINI_DEFAULT_MODEL ??
        "gemini-2.5-flash";

      return google(modelId);
    }

    default:
      throw new Error(
        `Unsupported AI provider: ${provider}`,
      );
  }
}