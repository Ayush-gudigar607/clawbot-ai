import { z } from "zod";

const envSchema = z.object({
  AI_PROVIDER: z.enum(["openrouter", "gemini"]).default("openrouter"),

  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_DEFAULT_MODEL: z.string().min(1).optional(),

  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_DEFAULT_MODEL: z.string().min(1).optional(),

  SUPERMEMORY_API_KEY: z.string().min(1).optional(),

  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_OWNER_ID: z.string().regex(/^\d+$/).optional(),
  TELEGRAM_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  TELEGRAM_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  TELEGRAM_MAX_TASK_LENGTH: z.coerce.number().int().positive().default(4_000),
  // Execution limits apply to all Telegram agent entry points.
  MAX_CONCURRENT_AGENTS: z.coerce.number().int().positive().default(2),
  MAX_AGENT_STEPS: z.coerce.number().int().positive().default(40),
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(1_000_000),
  MAX_TOOL_CALLS: z.coerce.number().int().positive().default(100),
  MAX_TASK_DURATION_MS: z.coerce.number().int().positive().default(300_000),
  TELEGRAM_SESSION_TTL_MS: z.coerce.number().int().positive().default(30 * 60_000),
  TELEGRAM_APPROVAL_TTL_MS: z.coerce.number().int().positive().default(10 * 60_000),
  TELEGRAM_API_RETRIES: z.coerce.number().int().min(0).max(5).default(3),
  REDIS_URL: z.string().url().optional(),

  FIRECRAWL_API_KEY: z.string().min(1).optional(),
  CLAWBOT_USER_ID: z.string().min(1).optional(),
  CLAWBOT_PROJECT_ID: z.string().min(1).optional(),
  SKILLS_DIRS: z.string().min(1).optional(),
  BUILTIN_SKILLS_DIRS: z.string().min(1).optional(),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export const env = envSchema.parse(process.env);

export type Env = typeof env;
