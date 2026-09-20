
### 3. `skills/testing/SKILL.md`

```markdown
---
name: testing
description: Design, write, run, and debug unit, integration, API, end-to-end, and regression tests with reliable verification.
---

# Testing Skill

Use this skill whenever implementing features, fixing bugs, refactoring code, or validating system behavior.

## Testing Workflow

1. Understand the expected behavior.
2. Inspect existing tests before writing new ones.
3. Identify the appropriate test level.
4. Write the smallest useful test.
5. Run the test.
6. Analyze failures.
7. Fix the implementation or test based on evidence.
8. Run related tests again.
9. Run the broader test suite when appropriate.

## Test Levels

### Unit Tests

Test isolated functions or modules.

Use for:

- utilities
- validation
- business logic
- parsers
- transformations

### Integration Tests

Test multiple components together.

Use for:

- database operations
- services
- queues
- API integrations
- repositories

### API Tests

Verify:

- HTTP method
- status code
- request validation
- response body
- authentication
- authorization
- error responses

### End-to-End Tests

Test complete user workflows across multiple components.

## Test Quality

Tests should be:

- deterministic
- isolated
- readable
- repeatable
- focused
- meaningful

Avoid tests that depend unnecessarily on:

- current time
- random values
- external services
- network availability
- machine-specific paths

## Regression Tests

When fixing a bug:

1. Reproduce the bug.
2. Add a test that fails before the fix.
3. Implement the fix.
4. Confirm the test passes.
5. Run related tests.

## Mocking

Mock external dependencies when appropriate.

Do not mock the system under test unnecessarily.

Prefer testing real behavior when integration behavior is important.

## Verification

Use the project's existing commands:

```bash
npm test
```