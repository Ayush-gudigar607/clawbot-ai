export const clip = (text: string, max = 4000) =>
  text.length <= max ? text : text.slice(0, max) + '\n…[truncated]';

export const replyMd = (ctx: { reply: (t: string, o?: object) => Promise<unknown> }, text: string) =>
  ctx.reply(clip(text), { parse_mode: 'Markdown' });

export function agentErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/free-models-per-day|rate limit exceeded|x-ratelimit-remaining.*0/i.test(message)) {
    return '⚠️ The AI provider daily free-model quota is exhausted. Please wait for the quota reset or configure an OpenRouter model/account with available credits, then try again.';
  }

  return '⚠️ The AI request failed. Please try again later.';
}

export async function reportAgentError(
  ctx: { reply: (t: string, o?: object) => Promise<unknown> },
  error: unknown,
  operation: string,
) {
  const userMessage = agentErrorMessage(error);
  if (userMessage.startsWith('⚠️ The AI provider daily free-model quota')) {
    console.error(`${operation} failed: ${userMessage}`);
  } else {
    console.error(`${operation} failed:`, error);
  }
  try {
    await ctx.reply(userMessage);
  } catch (replyError) {
    console.error('Failed to report AI error to Telegram:', replyError);
  }
}

/** Text after `/name …` */
export function commandArg(fullText: string, name: string): string {
  return fullText.replace(new RegExp(`^/${name}\\s*`, 'i'), '').trim();
}