---
name: typescript
description: Build, modify, debug, or review TypeScript code, types, compiler configuration, and package APIs. Use for .ts or .tsx work outside a more specialized skill.
---

# TypeScript

Read `tsconfig.json`, package scripts, existing types, and nearby code before making changes. Match the repository’s TypeScript version, module system, formatting, and runtime constraints.

## Type Design

- Model real states precisely with unions, discriminated unions, generics, and narrow interfaces where they improve correctness.
- Prefer `unknown` at untrusted boundaries and narrow it with validation or type guards. Avoid `any`, unsafe assertions, and non-null assertions unless an existing invariant proves them safe.
- Keep runtime validation distinct from compile-time types for data from files, networks, environment variables, or users.
- Export only intentional public types and values. Preserve backward compatibility for public APIs unless the user requests a breaking change.

## Implementation and Verification

- Preserve async error behavior and resource cleanup; avoid swallowing rejected promises.
- Use existing utilities and dependency patterns instead of adding packages for small helpers.
- Run the relevant type-check, lint, and tests. Fix type errors at their source rather than suppressing them, unless the requested change explicitly requires a justified exception.
