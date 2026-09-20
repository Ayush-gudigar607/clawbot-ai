---
name: workspace-task
description: Complete general workspace tasks by inspecting relevant files, making focused staged changes, and validating the result. Use when no more specific skill applies.
---

# Workspace Task

Use this as the default workflow for tasks in this codebase when a more specific skill does not cover the request.

## Workflow

1. Clarify the requested outcome from the user prompt. Inspect only the files needed to understand the affected area.
2. Preserve existing project conventions and keep the change focused on the requested outcome.
3. Use the staging tools for every mutation. Do not claim a change was applied until the approval flow has completed.
4. Before finishing, inspect the staged result and run an appropriate read-only or safe verification when the available tools permit it.
5. Report what changed, any verification performed, and any meaningful limitation or follow-up.

## Boundaries

- Prefer a specialized skill when one matches the task; read that skill before acting.
- Do not make unrelated cleanup, dependency upgrades, or external changes unless the user requests them.
- Treat file deletion, shell execution, and other consequential actions as requiring the normal approval flow.
