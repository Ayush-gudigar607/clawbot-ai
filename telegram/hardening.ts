import { env } from "../src/config/env";
import { logger } from "../src/logger";

interface RateWindow {
  startedAt: number;
  count: number;
}

const rateWindows = new Map<number, RateWindow>();
const activeExecutions = new Set<number>();
const handledCallbacks = new Map<string, number>();

export function validateTask(text: string): string | null {
  const task = text.trim();
  return task.length > env.TELEGRAM_MAX_TASK_LENGTH
    ? `Task is too long. Maximum length is ${env.TELEGRAM_MAX_TASK_LENGTH} characters.`
    : null;
}

export function allowRequest(chatId: number): boolean {
  const now = Date.now();
  const current = rateWindows.get(chatId);
  if (!current || now - current.startedAt >= env.TELEGRAM_RATE_LIMIT_WINDOW_MS) {
    rateWindows.set(chatId, { startedAt: now, count: 1 });
    return true;
  }

  if (current.count >= env.TELEGRAM_RATE_LIMIT_MAX) return false;
  current.count += 1;
  return true;
}

export function acquireExecution(chatId: number): (() => void) | null {
  if (activeExecutions.size >= env.MAX_CONCURRENT_AGENTS) return null;
  if (activeExecutions.has(chatId)) return null;

  activeExecutions.add(chatId);
  return () => activeExecutions.delete(chatId);
}

export function markCallbackHandled(callbackId: string): boolean {
  const now = Date.now();
  for (const [id, expiresAt] of handledCallbacks) {
    if (expiresAt <= now) handledCallbacks.delete(id);
  }
  if (handledCallbacks.has(callbackId)) return false;
  handledCallbacks.set(callbackId, now + env.TELEGRAM_SESSION_TTL_MS);
  return true;
}

export async function withTelegramRetry<T>(
  operation: string,
  action: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= env.TELEGRAM_API_RETRIES; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt >= env.TELEGRAM_API_RETRIES) break;
      const delay = Math.min(1_000 * 2 ** attempt, 8_000);
      logger.warn("Telegram API request failed; retrying", {
        operation,
        attempt: attempt + 1,
        delayMs: delay,
        error: error instanceof Error ? error.message : String(error),
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function resetTelegramHardeningState(): void {
  rateWindows.clear();
  activeExecutions.clear();
  handledCallbacks.clear();
}
