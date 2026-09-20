---
name: nodejs
description: Build, debug, and maintain Node.js applications using modern JavaScript/TypeScript, npm packages, environment variables, async workflows, HTTP servers, processes, and runtime APIs.
---

# Node.js Skill

Use this skill when working with Node.js applications, APIs, servers, CLI tools, or Node.js runtime behavior.

## Workflow

1. Inspect the existing project structure before changing code.
2. Check `package.json`, scripts, Node.js version, and package manager.
3. Identify whether the project uses ESM or CommonJS.
4. Understand environment variables and configuration before changing runtime code.
5. Reuse existing dependencies and project patterns.
6. Prefer TypeScript when the project already uses TypeScript.
7. Handle asynchronous operations with `async/await` and proper error handling.
8. Validate external input before using it.
9. Keep process lifecycle and resource cleanup in mind.
10. Run the relevant tests, type checks, and build commands after changes.

## Runtime

Pay attention to:

- Node.js version compatibility
- ESM vs CommonJS
- `package.json` configuration
- `process.env`
- `process.argv`
- filesystem operations
- streams
- child processes
- HTTP servers
- timers
- signals
- graceful shutdown

## Dependencies

Before adding a package:

- Check whether an existing dependency already provides the functionality.
- Prefer maintained and minimal dependencies.
- Verify package compatibility with the project's Node.js version.
- Update the correct lockfile.

## Environment Variables

Never hard-code secrets.

Use:

```text
.env
.env.example