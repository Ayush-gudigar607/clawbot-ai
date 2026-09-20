---
name: repo-workflow-commands
description: Git workflow, quality-gate, and repo-maintenance playbook for the claude-skills repository. Covers committing (Conventional Commits), commit-and-push, pull requests, branch cleanup, local review checks, security scans, post-creation docs/marketplace sync, SEO auditing of docs, the 8-phase plugin/skill audit, and the 5-phase focused-fix protocol for repairing a feature. Use this skill whenever the user mentions commit, push, PR, pull request, clean branches, review, lint, security scan, gitleaks, update docs, sync Codex/Gemini/OpenClaw, marketplace.json, plugin audit, SEO audit, or fixing a broken feature/module. Also use it for slash-style requests such as /git:cm, /git:cp, /git:pr, /git:clean, /review, /security-scan, /update-docs, /seo-auditor, /plugin-audit, /focused-fix, even if the user doesn't spell out the steps.
---

# Repo Workflow Commands

One skill that bundles every workflow command for the claude-skills repository: Git operations, quality gates, documentation sync, audits, and deep feature repair.

## How to use this skill

1. Identify which command the user wants (see the routing table).
2. Jump to that section and follow its steps in order.
3. Ask before doing anything destructive or irreversible (force-deleting branches, deleting remote branches, security auto-fixes).
4. Never skip a step silently. If a step fails or is unclear, stop and ask the user.

## Command routing table

| Command | What it does | Section |
|---|---|---|
| `/git:cm` | Stage and create a Conventional Commit (no push) | [1](#1-git-cm--commit-no-push) |
| `/git:cp` | Review, commit, push, trigger CI | [2](#2-git-cp--commit-and-push) |
| `/git:pr` | Open a pull request from the current branch | [3](#3-git-pr--create-pull-request) |
| `/git:clean` | Delete merged branches locally and on remote | [4](#4-git-clean--branch-cleanup) |
| `/review` | Local lint / syntax / link quality gate | [5](#5-review--local-quality-gate) |
| `/security-scan` | Secret and dependency vulnerability scan | [6](#6-security-scan--security-gate) |
| `/update-docs` | Post-creation sync: CLI platforms, marketplace, docs, GitHub Pages | [7](#7-update-docs--post-creation-sync-pipeline) |
| `/seo-auditor` | SEO scan and optimization of docs | [8](#8-seo-auditor--docs-seo-audit) |
| `/plugin-audit` | 8-phase audit of a skill directory | [9](#9-plugin-audit--8-phase-skill-audit) |
| `/focused-fix` | 5-phase deep repair of a feature/module | [10](#10-focused-fix--5-phase-feature-repair) |

## Typical flow

```
edit files
  -> /review
  -> /security-scan
  -> /git:cm        (commit locally, optional)
  -> /git:cp        (commit + push + CI)
  -> /git:pr        (open PR)
  -> wait for: Claude Code Review comment, CI Quality Gate, one human approval
  -> merge (linked issue auto-closes, project board moves to Done)
```

Quick fix: edit, `/review`, `/git:cp`.
New skill: create files, `/review`, `/security-scan`, `/git:cm`, test activation, `/git:cp`, `/git:pr`, then `/update-docs`.

| Command | Stage | Commit | Push | Quality check | Create PR |
|---|---|---|---|---|---|
| /git:cm | yes | yes | no | no | no |
| /git:cp | yes | yes | yes | yes (runs /review) | no |
| /git:pr | no | no | no | verify only | yes |
| /review | no | no | no | yes | no |
| /security-scan | no | no | no | yes | no |

---

## Shared conventions

### Conventional Commit format

```
<type>(<scope>): <subject>

## Context
- Why this change was needed
- What problem it solves

## Testing
- [ ] All Python scripts tested
- [ ] Skills validated with Claude
- [ ] /review passed
- [ ] /security-scan passed

## Reviewers
- [ ] @username
```

- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- **Scopes (kebab-case):** `marketing-skill`, `product-team`, `c-level-advisor`, `engineering-team`, `ra-qm-team`, `workflows`, `docs`, `ci`
- **Subject:** 72 characters or fewer
- **Template:** use `.github/commit-template.txt` for the Context / Testing / Reviewers blocks
- **Never add AI attribution strings to commits.**

Examples:

```
feat(marketing-skill): add LinkedIn content framework
fix(product-team): correct RICE prioritization calculation
docs(README): update skill installation instructions
ci(workflows): add auto-close issues on PR merge
```

### Staging rules

- Review every diff before staging and check for secrets or credentials.
- Stage intentionally, file by file. Avoid `git add .` unless every change was reviewed.
- Never stage generated files or secret files.

---

## 1. /git:cm — Commit (no push)

**Purpose:** stage working-tree changes and create a Conventional Commit locally.

1. Run `git status --short` to review pending changes.
2. For each file, run `git diff -- path/to/file` and confirm no secrets or credentials are present.
3. Stage intentionally: `git add path/to/file`.
4. Generate a Conventional Commit message (see conventions above). Fill in Context / Testing / Reviewers from `.github/commit-template.txt`.
5. Run `git commit` and use the generated message.
6. Show the result with `git log -1 --stat` and keep the commit hash handy.
7. **Do not push.** Use `/git:cp` when ready to publish.

---

## 2. /git:cp — Commit and push

**Purpose:** complete git workflow with quality checks.

1. Run `/review` (section 5) so lint, tests, and checks pass locally.
2. Review and stage changes with `git add` (no generated or secret files).
3. Craft a Conventional Commit message with Context / Testing / Reviewers blocks. Never add AI attribution.
4. Commit with `git commit`. If commitlint fails, fix the message and retry.
5. Push: `git push origin $(git branch --show-current)`
6. Trigger remote checks:
   ```bash
   gh workflow run ci-quality-gate.yml --ref $(git branch --show-current)
   ```
7. Wait for the workflow to finish before opening a PR:
   ```bash
   gh run watch --workflow ci-quality-gate.yml
   ```

---

## 3. /git:pr — Create pull request

**Arguments:** optional target branch (default `main`). `SOURCE_BRANCH` is `git branch --show-current`.

1. Confirm `/review` and `/security-scan` have passed locally.
2. Confirm the `ci-quality-gate` workflow succeeded for the source branch.
3. Create the PR:
   ```bash
   gh pr create \
     --base "$TARGET_BRANCH" \
     --head "$SOURCE_BRANCH" \
     --title "<Conventional PR title>" \
     --body-file .github/pull_request_template.md
   ```
   If no template exists, write a summary covering Context, Testing, and Security results.
4. Add labels: `gh pr edit --add-label "status: in-review"`
5. Share the PR link with reviewers and make sure at least one human approval is obtained.

Tips: link issues (`Fixes #123`), fill in the template completely, request specific reviewers.

**Emergency bypass (use sparingly, manual review is still recommended):** `git push --no-verify`, a `[EMERGENCY]` prefix in the PR title, or a PR label of `emergency`, `skip-review`, or `hotfix`.

---

## 4. /git:clean — Branch cleanup

**Purpose:** remove merged or stale branches, keeping only `main`, `dev`, and `gh-pages`.

1. **List local branches to delete:**
   ```bash
   git branch | grep -v -E '^\*|main$|dev$|gh-pages$'
   ```
   Report what will be deleted. If none, say "No local branches to clean" and skip to step 3.
2. **Delete fully merged local branches:** `git branch -d <branch-name>`
   If a branch is not fully merged, report it and ask whether to force-delete. **Never force-delete without confirmation.**
3. **List remote branches to delete:**
   ```bash
   git branch -r | grep -v -E 'origin/main$|origin/dev$|origin/gh-pages$|origin/HEAD'
   ```
   If none, say "No remote branches to clean" and skip to step 5.
4. **Confirm with the user** before deleting remote branches. Show the full list and wait for approval, then:
   ```bash
   git push origin --delete <branch-names>
   ```
5. **Prune stale remote refs:** `git remote prune origin`
6. **Report the final state** (`git branch`, `git branch -r`) with a summary table:

| Item | Count |
|---|---|
| Local branches deleted | N |
| Remote branches deleted | N |
| Remaining local | main, dev |
| Remaining remote | origin/main, origin/dev, origin/gh-pages |

---

## 5. /review — Local quality gate

**Purpose:** run all quality checks before committing or pushing.

1. Save work in progress; the working tree should be clean except for intentional changes.
2. Install tooling (first run only):
   ```bash
   pip install --upgrade pip
   pip install yamllint==1.35.1 check-jsonschema==0.28.4 safety==3.2.4
   npm install --global markdown-link-check@3.12.2
   ```
3. Lint GitHub workflows:
   ```bash
   yamllint -d '{extends: default, rules: {line-length: {max: 160}}}' .github/workflows
   check-jsonschema --schema github-workflow --base-dir . .github/workflows/*.yml
   ```
4. Python syntax check:
   ```bash
   python -m compileall marketing-skill product-team c-level-advisor engineering-team ra-qm-team
   ```
5. Markdown sanity check: `markdown-link-check README.md`
6. Optional dependency audit (if `requirements*.txt` exists):
   ```bash
   for f in $(find . -name "requirements*.txt" 2>/dev/null); do
       safety check --full-report --file "$f"
   done
   ```
7. Summarize results in the commit template's Testing section. Fix any failures before continuing.

---

## 6. /security-scan — Security gate

**Purpose:** detect committed secrets and vulnerable Python dependencies. Run before pushing, especially when adding dependencies.

1. Install dependencies:
   ```bash
   pip install safety==3.2.4
   brew install gitleaks   # or the appropriate package manager
   ```
2. Scan for committed secrets and resolve every finding before continuing:
   ```bash
   gitleaks detect --verbose --redact
   ```
3. Audit Python dependencies (if requirements files exist):
   ```bash
   for f in $(find . -name "requirements*.txt" 2>/dev/null); do
       safety check --full-report --file "$f"
   done
   ```
4. Record results in the commit template's Testing section.
5. After a clean pass, continue with the commit and push workflow.

---

## 7. /update-docs — Post-creation sync pipeline

**When:** after creating or changing any skill, agent, or command. Execute every step. If something is unclear or fails, ask the user before continuing.

### Step 1: Inventory what changed

Run `git status --short` and classify each change as: new skill (folder with `SKILL.md` under a domain directory), new agent (`agents/*.md`), new command (`commands/*.md`), modified, or deleted. Report the inventory to the user before proceeding.

### Step 2: Cross-platform CLI sync

- **2a. Codex CLI:** `python3 scripts/sync-codex-skills.py --verbose`. Check `.codex/skills-index.json` for the right `total_skills` and that new skills appear.
- **2b. Gemini CLI:** `python3 scripts/sync-gemini-skills.py --verbose`. Check `.gemini/skills-index.json` for the right total; new skills, agents, and commands need entries and symlinks under `.gemini/skills/`.
- **2c. OpenClaw:** confirm `scripts/openclaw-install.sh` will pick up the new skills and that no filter excludes the new directories. No separate sync is needed.

Report per-platform skill counts to the user.

### Step 3: Claude Code plugin marketplace

- **3a. Domain `plugin.json`:** for each changed domain, update `.claude-plugin/plugin.json` (accurate skill/tool/reference counts in `description`, `version` if needed, correct `source` paths). Domains: `marketing-skill`, `engineering-team`, `engineering`, `product-team`, `c-level-advisor`, `project-management`, `ra-qm-team`, `business-growth`, `finance`.
- **3b. Root `.claude-plugin/marketplace.json`:** update `metadata.description` with accurate totals (skills, tools, references, agents, commands); add a `plugins` entry for new standalone skills; update `keywords`; verify every `source` path exists.

### Step 4: Update documentation files

- **4a. Root `CLAUDE.md`:** Current Scope counts, Repository Structure counts, Navigation Map, Current Version bullet, Roadmap counts.
- **4b. Domain `CLAUDE.md` files** (`agents`, `marketing-skill`, `product-team`, `engineering-team`, `c-level-advisor`, `project-management`, `ra-qm-team`, `business-growth`, `finance`, `standards`, `templates`): skill and script counts, agent and command references, new cross-domain integrations.
- **4c. Root `README.md`:** badge counts, tagline count, Skills Overview table, Quick Install section, Python Analysis Tools section (add examples for new tools), FAQ counts.
- **4d. `docs/index.md`:** `description` meta tag, hero subtitle count, grid cards, domain cards.
- **4e. `docs/getting-started.md`:** `description` meta tag, Available Bundles table, Python Tools count, FAQ counts.

### Step 5: Regenerate GitHub Pages

```bash
python3 scripts/generate-docs.py
```

This generates pages for every skill, agent, and command plus the index pages.

- **5a.** Update `mkdocs.yml` `nav:` (new skills under the right domain, new agents, new commands) and `site_description` counts.
- **5b.** Verify the build:
  ```bash
  python3 -m mkdocs build 2>&1 | tail -5
  ```
  It should finish without errors. Relative-link warnings from SKILL.md files (`references/`, `scripts/`) are expected. Report the result and page count.

### Step 6: Consistency verification

1. **Counts** match across root `CLAUDE.md`, root `README.md`, `docs/index.md`, `docs/getting-started.md`, and `.claude-plugin/marketplace.json`.
2. **Paths:** every `source` in `marketplace.json` points to an existing directory.
3. **New scripts** run: `python3 path/to/new/script.py --help`.
4. **Frontmatter:** every new SKILL.md, agent, and command file has valid YAML frontmatter with at least `name` and `description`.

Fix any inconsistencies before finishing.

### Step 7: Summary report

| Item | Status |
|---|---|
| New skills / agents / commands added | [list] |
| Codex CLI sync | count |
| Gemini CLI sync | count |
| OpenClaw compatible | yes/no |
| Marketplace updated | yes/no |
| CLAUDE.md files updated | [count]/[total] |
| README.md updated | yes/no |
| GitHub Pages regenerated | [page count] pages |
| MkDocs build | pass/fail |
| Consistency check | pass/fail |

Then ask the user whether to commit and push the changes.

---

## 8. /seo-auditor — Docs SEO audit

**Target:** a path from the user (default: all `docs/` and the root `README.md`). If the user asks for **report-only**, scan without making changes.

**Rules:** auto-fix non-destructive issues only. **Never change URLs.** Preserve content on pages that already rank well and fix only critical issues there.

### Phase 1: Discovery
Find `docs/**/*.md` and the domain-root `README.md` files (or only the requested path). For each file record: `title:`, `description:`, H1, H2s, word count, link count. This is the baseline for the report. Identify recently changed files: `git log --oneline -2 --name-only -- docs/ README.md`.

### Phase 2: Meta tags
For each file with YAML frontmatter:
- **Title:** 50-60 characters, contains the primary keyword, unique across pages. Auto-fix generic titles using domain context.
- **Description:** 120-160 characters, contains the primary keyword, unique. Auto-fix from SKILL.md frontmatter or the first paragraph.

Run the checker on built pages:
```bash
python3 marketing-skill/skills/seo-audit/scripts/seo_checker.py --file site/{path}/index.html
```

### Phase 3: Content quality
- **Headings:** one H1 per page, no skipped levels, keywords in headings.
- **Readability** (target readability >= 70, structure >= 60):
  ```bash
  python3 marketing-skill/skills/content-production/scripts/content_scorer.py {file}
  ```
- **AI detection** (non-generated files only; flag pages scoring below 50):
  ```bash
  python3 marketing-skill/skills/content-humanizer/scripts/humanizer_scorer.py {file}
  ```
  Fix AI cliches such as "delve", "leverage", "it's important to note", "comprehensive".

### Phase 4: Keywords
Primary keyword must appear in the title, description, H1, first paragraph, and at least one H2. Density 1-2%; flag and reduce above 3%.

### Phase 5: Links
- Verify internal `[text](url)` targets exist and fix broken ones.
- Find duplicate descriptions and make each unique:
  ```bash
  grep -rh '^description:' docs/**/*.md | sort | uniq -d
  ```
- Find orphan pages (not in `mkdocs.yml` nav) and add them.

### Phase 6: Sitemap
```bash
mkdocs build
python3 marketing-skill/skills/site-architecture/scripts/sitemap_analyzer.py site/sitemap.xml
```
Verify all pages appear, with no duplicates or broken URLs.

### Phase 7: Report
Pages scanned, issues found, auto-fixes applied, manual-review items, broken links fixed, orphans resolved, sitemap URL count, and the list of preserved (unmodified) pages.

---

## 9. /plugin-audit — 8-phase skill audit

**Target:** the skill directory path from the user; ask if none is given. Run all 8 phases in order. Auto-fix non-critical issues. Prompt the user only for critical decisions (external dependencies, security findings, breaking changes).

### Phase 1: Discovery
1. Verify the path exists and contains `SKILL.md`; otherwise error and stop.
2. Read the frontmatter: `name`, `description`, `Category`, `Tier`.
3. Detect components: `scripts/*.py` (Python tools), `references/*.md`, `assets/`, `expected_outputs/`, `agents/*.md`, `skills/*/SKILL.md` (compound skill), `.claude-plugin/plugin.json` (standalone plugin), `settings.json` (command registrations).
4. Detect the domain from the path (`engineering/`, `product-team/`, `marketing-skill/`, ...).
5. Search `commands/` for a `.md` file matching the skill name.
6. Display a discovery summary.

### Phase 2: Structure validation
```bash
python3 engineering/skill-tester/scripts/skill_validator.py <path> --json
```
If the score is below 75, auto-fix missing frontmatter fields, section headings, and directories, then re-run. If still below 75, mark FAIL but keep collecting results.

### Phase 3: Quality scoring
```bash
python3 engineering/skill-tester/scripts/quality_scorer.py <path> --detailed --json
```
If the score is below 60, report the improvement roadmap.

### Phase 4: Script testing
If `<path>/scripts/` has `.py` files:
```bash
python3 engineering/skill-tester/scripts/script_tester.py <path> --json --verbose
```
All scripts must PASS. If any script uses external imports, **ask the user** whether the dependency is acceptable.

### Phase 5: Security audit
```bash
python3 engineering/skill-security-auditor/scripts/skill_security_auditor.py <path> --strict --json
```
Zero CRITICAL or HIGH findings are required. **Do not auto-fix security issues.** Report each with file, line, pattern, and recommended fix.

### Phase 6: Marketplace and plugin compliance
- **6a. `plugin.json`** (if present): valid JSON; only the fields `name`, `description`, `version`, `author`, `homepage`, `repository`, `license`, `skills`; version must be `2.1.2`. Auto-fix version mismatches and remove extra fields.
- **6b. `settings.json`** (if present): valid JSON; version matches the repo version; each command listed has a matching `commands/*.md`.
- **6c. Marketplace entry:** in `.claude-plugin/marketplace.json`, find the entry whose `source` matches `./<path>` and verify version and name.
- **6d. Domain `plugin.json`:** verify the skill count in the description matches reality; auto-fix stale counts.

### Phase 7: Ecosystem integration
- **7a. Cross-platform sync:** confirm the skill appears in `.codex/skills-index.json` and `.gemini/skills-index.json`. If missing, run `python3 scripts/sync-codex-skills.py --verbose` and `python3 scripts/sync-gemini-skills.py --verbose`.
- **7b. Commands:** valid frontmatter, correct skill reference, present in `mkdocs.yml` nav (auto-fix missing nav entries).
- **7c. Agents:** check `<path>/agents/` and any `cs-*` agents in `agents/` that reference this skill; verify references resolve.
- **7d. Cross-skill dependencies:** verify every referenced skill (`../` paths, "Related Skills" sections) exists.

### Phase 8: Domain code review
Pick the reviewing agent by domain, read its `.md` file for review criteria, and apply them to SKILL.md, scripts, and references.

| Domain | Agent | Focus |
|---|---|---|
| `engineering/`, `engineering-team/` | cs-senior-engineer | Architecture, code quality, CI/CD |
| `product-team/` | cs-product-manager | PRD quality, user stories, RICE |
| `marketing-skill/` | cs-content-creator | Content quality, SEO, brand voice |
| `ra-qm-team/` | cs-quality-regulatory | Compliance, audit trail, regulatory |
| `business-growth/` | cs-growth-strategist | Growth metrics, revenue impact |
| `finance/` | cs-financial-analyst | Model accuracy, metric definitions |
| Other | cs-senior-engineer | General code review |

Check that workflows are actionable and complete, scripts solve the stated problem, references are accurate, there are no broken internal links, and attribution is present where required.

### Final report

```
PLUGIN AUDIT REPORT: {skill_name}
  Phase 1 - Discovery          {type}, {domain}
  Phase 2 - Structure          {score}/100 ({level})
  Phase 3 - Quality            {score}/100 ({grade})
  Phase 4 - Scripts            {n}/{n} PASS
  Phase 5 - Security           PASS (0 critical, 0 high)
  Phase 6 - Marketplace        plugin.json valid
  Phase 7 - Ecosystem          synced
  Phase 8 - Code Review        passed

  VERDICT: PASS
  Auto-fixes: {n} | Warnings: {n} | Action items: {n}
```

**Verdict rules:**
- All phases pass: **PASS**
- Only warnings: **PASS WITH WARNINGS**
- Any blocker (structure < 75, quality < 60, script FAIL, security CRITICAL/HIGH, invalid plugin.json): **FAIL**

---

## 10. /focused-fix — 5-phase feature repair

**Target:** the feature/module path from the user; ask which feature to fix if none is given. If the repo has `engineering/focused-fix/SKILL.md`, read it and follow it. Execute ALL 5 phases IN ORDER.

> **Iron Law: no fixes before completing Phase 3. No exceptions.**

1. **SCOPE:** map the feature boundary: all files, entry points, and internal files.
2. **TRACE:** map inbound and outbound dependencies across the entire codebase.
3. **DIAGNOSE:** check code, runtime, tests, logs, and config. Assign risk labels (HIGH / MED / LOW). Confirm root causes with evidence, not guesses.
4. **FIX:** repair in this order: dependencies, types, logic, tests, integration. One fix at a time, testing after each. Use 3-strike escalation: if fixes start cascading, stop and escalate to the user.
5. **VERIFY:** run all feature tests plus consumer tests. Summarize the changes made.

---

## Environment setup (Claude Code `settings.json`)

To enable the ECC plugin marketplace used with this repository:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "extraKnownMarketplaces": {
    "ecc": {
      "source": { "source": "github", "repo": "affaan-m/ECC" }
    }
  },
  "enabledPlugins": { "ecc@ecc": true }
}
```

## Safety rules (apply to every command)

- Never force-delete branches or delete remote branches without explicit confirmation.
- Never commit secrets; review every diff first.
- Never add AI attribution strings to commits.
- Never change existing URLs during SEO work.
- Never auto-fix security findings; report them.
- Never start fixing before diagnosis is complete (`/focused-fix`).
- If a step is ambiguous or fails, stop and ask the user.

## Command file locations (reference)

```
.claude/commands/
├── git/
│   ├── cm.md
│   ├── cp.md
│   ├── pr.md
│   └── clean.md
├── review.md
├── security-scan.md
├── update-docs.md
├── seo-auditor.md
├── plugin-audit.md
├── focused-fix.md
└── README.md
```
