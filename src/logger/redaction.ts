const SENSITIVE_KEY = /api[_-]?key|token|password|secret|authorization|credential|cookie|private[_ -]?key|\.env/i;
const SENSITIVE_VALUE = /(?:bearer\s+|sk-|sm_|AIza|gh[pousr]_)[A-Za-z0-9._~+/=-]+/gi;
const INLINE_SECRET = /((?:api[_-]?key|password|secret|token|authorization)\s*[:=]\s*)([^\s,}]+)/gi;

export function redact(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";

  if (typeof value === "string") {
    return value
      .replace(INLINE_SECRET, "$1[REDACTED]")
      .replace(SENSITIVE_VALUE, "[REDACTED]");
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redact(entryValue, entryKey),
      ]),
    );
  }

  return value;
}
