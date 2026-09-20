import { describe, expect, test } from "bun:test";
import { parseSkillFrontmatter } from "./skill-validation";

describe("parseSkillFrontmatter", () => {
  test("validates required metadata and YAML-style arrays", () => {
    const metadata = parseSkillFrontmatter(`---
name: filesystem
description: Manage workspace files safely.
version: 1.2.3
allowedTools: [read_file, write_file]
resources: []
---
# Instructions
`);

    expect(metadata).toEqual({
      name: "filesystem",
      description: "Manage workspace files safely.",
      version: "1.2.3",
      allowedTools: ["read_file", "write_file"],
      resources: [],
    });
  });

  test("rejects missing required metadata", () => {
    expect(() => parseSkillFrontmatter("---\nname: incomplete\n---")).toThrow();
  });
});