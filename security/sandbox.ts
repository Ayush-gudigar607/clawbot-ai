import { spawn } from "node:child_process";
import path from "node:path";

//provide sandbox options 
export interface SandboxOptions {
  cwd: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

//provides sandbox results
export interface SandboxResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const DEFAULT_TIMEOUT = 60_000;
const DEFAULT_MAX_OUTPUT = 2 * 1024 * 1024;

export async function executeSandboxed(
  executable: string,
  args: string[],
  options: SandboxOptions,
): Promise<SandboxResult> {
  const cwd = path.resolve(options.cwd);

  const timeoutMs =
    options.timeoutMs ?? DEFAULT_TIMEOUT;

  const maxOutputBytes =
    options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT;

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,

      /*
       * IMPORTANT:
       *
       * Do NOT use:
       *
       * shell: true
       *
       * This means the arguments are passed directly
       * to the executable.
       */
      shell: false,

      windowsHide: true,

      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
    });

    let stdout = "";
    let stderr = "";
    let totalOutput = 0;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;

      child.kill("SIGTERM");

      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 2_000);
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      totalOutput += chunk.length;

      if (totalOutput <= maxOutputBytes) {
        stdout += chunk.toString();
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      totalOutput += chunk.length;

      if (totalOutput <= maxOutputBytes) {
        stderr += chunk.toString();
      }
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);

      resolve({
        exitCode: code ?? -1,
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}