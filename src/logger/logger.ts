import { redact } from "./redaction";
import { env } from "../config/env";

type LogMetadata = Record<string, unknown>;

function formatMetadata(metadata: LogMetadata): string {
  const safeMetadata = redact(metadata);
  const serialized = JSON.stringify(safeMetadata);
  return serialized === "{}" ? "" : ` ${serialized}`;
}

function write(
  level: "DEBUG" | "INFO" | "WARN" | "ERROR",
  message: string,
  metadata: LogMetadata,
): void {
  const line = `${new Date().toISOString()} ${level} ${message}${formatMetadata(metadata)}`;

  if (level === "ERROR" || level === "WARN") {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export const logger = {
  debug(message: string, metadata: LogMetadata = {}): void {
    if (env.NODE_ENV !== "production") write("DEBUG", message, metadata);
  },

  info(message: string, metadata: LogMetadata = {}): void {
    write("INFO", message, metadata);
  },

  warn(message: string, metadata: LogMetadata = {}): void {
    write("WARN", message, metadata);
  },

  error(message: string, metadata: LogMetadata = {}): void {
    write("ERROR", message, metadata);
  },
};
