import { describe, expect, test } from "bun:test";
import { parseSkillFrontmatter } from "../../skills/skill-validation";

describe("skill loader", () => {
  test("requires validated skill metadata before loading", () => {
    const metadata = parseSkillFrontmatter(`---
name: test-skill
description: A test skill.
version: 1.0.0
allowedTools: [read_file]
resources: []
---

Instructions
`);

    expect(metadata.name).toBe("test-skill");
    expect(metadata.allowedTools).toEqual(["read_file"]);
  });

  test("rejects a skill without version metadata", () => {
    expect(() => parseSkillFrontmatter("---\nname: unsafe\ndescription: Missing version\n---")).toThrow();
  });
});
