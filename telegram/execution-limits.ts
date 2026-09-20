import { env } from "../src/config/env";

/** Shared budget for one user-requested agent task. */
export class ExecutionLimits {
  private readonly controller = new AbortController();
  private readonly timeout: ReturnType<typeof setTimeout>;
  private toolCalls = 0;

  constructor() {
    this.timeout = setTimeout(() => {
      this.controller.abort(new Error(`Task exceeded ${env.MAX_TASK_DURATION_MS}ms limit`));
    }, env.MAX_TASK_DURATION_MS);
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  recordToolCalls(count: number): void {
    this.toolCalls += count;
    if (this.toolCalls > env.MAX_TOOL_CALLS) {
      this.controller.abort(new Error(`Task exceeded ${env.MAX_TOOL_CALLS} tool-call limit`));
    }
  }

  shouldStop(toolCalls: number): boolean {
    return this.controller.signal.aborted || this.toolCalls + toolCalls >= env.MAX_TOOL_CALLS;
  }

  throwIfExceeded(): void {
    if (this.controller.signal.aborted) {
      throw this.controller.signal.reason instanceof Error
        ? this.controller.signal.reason
        : new Error("Task execution limit exceeded");
    }
  }

  dispose(): void {
    clearTimeout(this.timeout);
  }
}
