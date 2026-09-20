---
name: react
description: Build, modify, debug, or review React components, hooks, state, and client-side UI behavior. Use for React or JSX/TSX tasks.
---

# React

Follow the existing application’s framework, router, styling, component library, state-management approach, and test conventions before introducing new patterns.

## Component Work

- Keep components focused around a coherent UI responsibility. Lift or share state only when multiple consumers need it.
- Derive display values during render where possible; avoid effects for values that can be calculated from props or state.
- Use effects only for synchronizing with external systems, and provide correct dependency handling and cleanup for subscriptions, timers, or requests.
- Preserve stable keys for collections. Do not use array indices as keys when items can be reordered, inserted, or removed.
- Handle loading, empty, error, and disabled states where the feature can encounter them.

## Accessibility and UI Quality

- Use semantic HTML first. Give controls accessible names, pair labels with inputs, and keep keyboard interaction and focus behavior intact.
- Do not hide functionality behind pointer-only interactions. Use appropriate ARIA only when native semantics cannot express the behavior.
- Reuse existing design tokens and shared components rather than creating visually inconsistent replacements.

## Verification

Run the project’s relevant lint, type-check, unit, or component tests when available. For behavior changes, verify the user-visible flow rather than only a successful build.
