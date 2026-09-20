
### 4. `skills/debugging/SKILL.md`

```markdown
---
name: debugging
description: Systematically diagnose and fix software bugs using errors, logs, reproduction steps, code inspection, configuration analysis, and verification.
---

# Debugging Skill

Use this skill whenever code produces an error, unexpected behavior, crash, incorrect output, or failing test.

## Debugging Workflow

Follow this order:

1. Capture the exact error.
2. Reproduce the problem.
3. Identify the failing component.
4. Inspect the relevant code.
5. Check configuration and environment variables.
6. Trace the execution flow.
7. Form a specific hypothesis.
8. Make the smallest appropriate fix.
9. Reproduce the original failure.
10. Run regression tests.

## Evidence First

Use:

- stack traces
- logs
- error messages
- test failures
- HTTP responses
- database errors
- configuration
- runtime versions
- recent code changes

Do not guess when evidence is available.

## Common Checks

For Node.js/TypeScript:

- `package.json`
- lockfile
- Node/Bun version
- imports
- module system
- environment variables
- async errors
- path resolution
- database connections
- network configuration
- Docker configuration

## Error Analysis

Separate:

```text
Symptom
↓
Immediate cause
↓
Root cause
↓
Fix
↓
Verification