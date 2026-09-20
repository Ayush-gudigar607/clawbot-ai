
### 6. `skills/security/SKILL.md`

```markdown
---
name: security
description: Identify and prevent common application, API, CLI, dependency, authentication, authorization, secret-management, filesystem, and infrastructure security issues.
---

# Security Skill

Use this skill whenever code handles secrets, authentication, authorization, user input, files, shell commands, APIs, databases, network services, or external dependencies.

## Security Workflow

1. Identify the assets being protected.
2. Identify trust boundaries.
3. Inspect external inputs.
4. Check authentication and authorization.
5. Check secret handling.
6. Check filesystem and command execution.
7. Check dependency and configuration risks.
8. Apply the smallest safe fix.
9. Test the security-sensitive behavior.

## Secrets

Never hard-code:

- API keys
- passwords
- tokens
- private keys
- database credentials
- session secrets

Prefer:

```text
.env
environment variables
secret managers