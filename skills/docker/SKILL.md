---
name: docker
description: Create, modify, troubleshoot, or review Dockerfiles, Compose files, container builds, and local container workflows.
---

# Docker

Use this skill for container definitions and Docker-based development or deployment workflows.

## Inspect Before Changing

Read the Dockerfile, Compose files, ignore files, package manifests, startup scripts, and deployment documentation relevant to the requested service. Preserve the project’s runtime, package manager, ports, volumes, and environment-variable conventions.

## Build and Runtime Guidance

- Prefer small, reproducible images: pin a compatible base image where the project does, copy dependency manifests before application code, and use a multi-stage build when it materially reduces the runtime image.
- Run the application as a non-root user when compatible with the service and mounted-volume permissions.
- Keep build-time secrets out of image layers, source control, image arguments, and logs. Use runtime secret mechanisms where available.
- Use `.dockerignore` to exclude dependencies, build output, credentials, VCS metadata, and unrelated large files when those are not needed by the build.
- In Compose, use explicit service dependencies and health checks only when they affect readiness; do not mistake start order for readiness.

## Verification

Validate syntax and, when available and safe, build or run the affected service. Report required environment variables, exposed ports, persisted volumes, and any command needed to start it.
