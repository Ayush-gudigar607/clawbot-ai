import {
    Output,
    extractJsonMiddleware,
    generateText,
    stepCountIs,
    tool,
    wrapLanguageModel,
} from "ai";
import { z } from "zod";
import chalk from "chalk";
import {getAgentModel} from "../../ai/ai.config.ts";
import { ActionTracker } from "../agents/action-tracker.ts";
import { ToolExecutor } from "../agents/tool-executor.ts";
import {defaultAgentConfig} from "../agents/types.ts";


