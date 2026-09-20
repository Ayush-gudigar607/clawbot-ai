
### `skills/curl/SKILL.md`

```markdown
---
name: curl
description: Use curl safely for HTTP and HTTPS requests, API testing, authentication, headers, JSON payloads, uploads, downloads, debugging, and network troubleshooting.
---

# cURL Skill

Use this skill when interacting with HTTP/HTTPS APIs, testing endpoints, downloading resources, inspecting responses, or debugging network communication.

## Workflow

1. Identify the HTTP method.
2. Identify the URL and endpoint.
3. Determine required headers.
4. Determine authentication requirements.
5. Build the smallest useful request.
6. Inspect the response status, headers, and body.
7. Reproduce and verify failures.
8. Never expose secrets unnecessarily.

## Basic Requests

GET:

```bash
curl https://example.com