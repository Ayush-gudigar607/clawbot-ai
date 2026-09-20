---
name: code-review
description: Review code changes for correctness, regressions, security concerns, and missing tests. Use for pull-request reviews, change reviews, or requests to find bugs without editing code.
---

# Code Review

Review the proposed change in its repository context. Prioritize actionable findings over summaries.

## Process

1. Identify the changed files and inspect their callers, types, tests, configuration, and relevant error paths.
2. Check correctness first: behavior changes, edge cases, state transitions, input validation, error handling, concurrency, and compatibility.
3. Check security and data handling when the change crosses trust boundaries, handles credentials, accepts user input, or calls external services.
4. Check whether tests cover new behavior and meaningful failure cases. Do not require tests where they add no confidence.

## Reporting

- Report findings in descending severity, each with file and line reference, impact, and a concrete reason it is a defect.
- Do not present style preferences or speculative concerns as bugs.
- If no findings remain, say so and state any residual test or inspection limitations.
- Do not modify files unless the user asks for a fix.
