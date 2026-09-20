import path from "node:path";

export interface ParsedCommand {
  executable: string;
  args: string[];
  raw: string;
}

export function parseCommand(command: string): ParsedCommand {
  const raw = command.trim();

  if (!raw) {
    throw new Error("Command cannot be empty");
  }

  const tokens = tokenize(raw);

  if (tokens.length === 0) {
    throw new Error("Invalid command");
  }

  const executable = path.basename(tokens[0]!);

  return {
    executable,
    args: tokens.slice(1),
    raw,
  };
}

/**
 * Lightweight shell tokenizer.
 *
 * This is intentionally conservative.
 * Complex shell syntax should be rejected rather than interpreted.
 */
function tokenize(command: string): string[] {
  const tokens: string[] = [];

  let current = "";
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }

      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
//@ts-ignore
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }

      continue;
    }

    current += char;
  }

  if (quote) {
    throw new Error("Unclosed quote in command");
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}