---
name: filesystem
description: Safely manage files and folders in the workspace. Supports creating, reading, modifying, deleting, renaming, copying, moving, and listing files and directories while enforcing workspace boundaries, path validation, approval requirements, and safe destructive-operation handling.
---

# Filesystem Skill

## Purpose

Use this skill whenever the user asks Clawbot to work with files or folders.

This skill provides safe filesystem operations while protecting the workspace from accidental modification, path traversal, unintended deletion, and destructive recursive operations.

The primary rule is:

> Perform only the filesystem operation requested by the user and do not modify unrelated files.

---

# Supported Operations

The filesystem skill supports:

- Create file
- Read file
- Modify file
- Delete file
- Create folder
- List folder
- Delete folder
- Rename file
- Rename folder
- Move file
- Move folder
- Copy file
- Copy folder
- Check whether a path exists
- Inspect file metadata
- Inspect directory structure

---

# Workspace Boundary

All filesystem operations must remain inside the configured workspace.

The workspace root is provided by the agent runtime.

Example:

```text
workspace/
├── src/
├── tests/
├── package.json
└── README.md