---
name: linux
description: Work with Linux systems, shell commands, filesystems, processes, permissions, networking, services, environment variables, logs, and system administration safely.
---

# Linux Skill

Use this skill when working with Linux terminals, servers, containers, shell commands, system processes, filesystems, permissions, networking, or system administration.

## Workflow

1. Identify the operating system and environment.
2. Inspect the current directory and relevant files.
3. Understand the command before executing it.
4. Prefer safe, reversible commands.
5. Avoid destructive operations unless explicitly required.
6. Verify the result after changes.

## Filesystem

Common commands:

```bash
pwd
ls -la
cd <directory>
find <path> -name "<pattern>"
grep -R "<pattern>" <path>
cat <file>
less <file>
head <file>
tail <file>