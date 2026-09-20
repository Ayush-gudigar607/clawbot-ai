import { z } from "zod";

const skillFrontmatterSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  allowedTools: z.array(z.string().trim().min(1)).max(100),
  resources: z.array(z.string().trim().min(1)).max(100),
});

export type SkillFrontmatter = z.infer<typeof skillFrontmatterSchema>;

function parseValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
    }
  }
  return trimmed;
}

export function parseSkillFrontmatter(content: string): SkillFrontmatter {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    throw new Error("missing YAML frontmatter");
  }

  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end < 0) throw new Error("frontmatter is not closed");

  const raw: Record<string, unknown> = {};
  for (const line of lines.slice(1, end)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator <= 0) throw new Error(`invalid frontmatter line: ${line}`);
    const key = line.slice(0, separator).trim();
    raw[key] = parseValue(line.slice(separator + 1));
  }

  const parsed = {
    ...raw,
    allowedTools: raw.allowedTools ?? raw["allowed-tools"],
  };
  const result = skillFrontmatterSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join("; "));
  }
  return result.data;
}
