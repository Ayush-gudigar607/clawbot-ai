
### 2. `skills/bun/SKILL.md`

```markdown
---
name: bun
description: Work with Bun as a JavaScript runtime, package manager, test runner, bundler, and development tool.
---

# Bun Skill

Use this skill when a project uses Bun or when the user explicitly requests Bun commands or tooling.

## Workflow

1. Inspect `package.json`.
2. Check `bunfig.toml` if present.
3. Identify the existing lockfile.
4. Prefer Bun commands when the project is configured for Bun.
5. Preserve the existing package manager unless the user asks to migrate.
6. Run tests and builds after changes.

## Common Commands

Install dependencies:

```bash
bun install