---
name: gitwork
description: "Safe Git completion for implementation tasks in the active project. Check the baseline, isolate task changes, exclude local artifacts, and commit verified changes unless the user opts out. Use for project file changes or explicit Git completion requests; skip read-only tasks and auto-created standalone chat folders unless explicitly requested."
---

# Gitwork

Run this workflow around every qualifying task. Treat safe ownership of the commit as more important than forcing a commit.

## Plugin scope and user preferences

This skill guides Codex to run Git commands with the host's existing tools. The Git 总览 panel and MCP tools remain read-only. Automatic completion can create a local commit; it does not authorize pushing, rewriting history, or changing global settings. Honor a request to leave changes uncommitted, generate a message only, or avoid Git entirely. Installing the plugin is not permission for unrelated operations.

Follow the target project's `AGENTS.md` and the user's commit conventions before the fallback below. When good-readme is also available and applies, complete its documentation gate before reviewing the final task diff and committing. Do not require that skill to be installed: otherwise inspect documentation impact as part of ordinary completion. Use the loaded plugin skills, never a hard-coded personal skill path. If a personal copy is also loaded, apply one coherent workflow rather than making two commits.

## Gate Git operations

Perform this gate before running any Git command:

1. Confirm that the current Codex runtime supplies the active root and identify the surface. For a desktop local project, use its primary folder. For CLI or IDE, use the session directory or open workspace. Do not judge by whether the folder already contains code, manifests, or Git metadata.
2. Detect a Codex desktop standalone-chat root by its canonical auto-created path `~/Documents/Codex/<YYYY-MM-DD>/<chat-name>`. Do not implicitly run this workflow there, even though the chat has a writable workspace folder. Continue only when the user explicitly invokes `$gitwork` or explicitly requests Git operations for that chat folder.
3. A managed Git worktree explicitly designated by the runtime as the active project is a valid root. Ignore unrelated Codex-managed temporary or internal locations such as `~/.codex/visualizations`. Do not infer a root from conversation content or arbitrary shell paths. In a multi-root workspace, use the runtime-designated primary/current root; do not guess among roots. If there is no unambiguous qualifying root, stop this workflow without running `git init`, `git add`, or `git commit`.
4. For automatic initialization, reject a filesystem root, the user's home directory, `~/Documents/Codex`, a date container directly below it, or another similarly broad location. Ask the user to open or select a narrower project folder instead of initializing Git in a broad root.
5. Use the qualifying root itself as the only project root. Do not inherit a Git repository above it, search for repositories below it, or operate on paths outside it.
6. Run automatic completion only when the task changes project files inside that root. Skip read-only, explanation, research, planning, and review tasks. For an explicit Git request (such as creating a branch), perform only that request and its relevant safety checks; do not initialize, stage, or commit merely because this skill was invoked.

## Establish the baseline

Run this at the start of the task, before editing files:

1. Resolve the canonical project-root path.
2. Recognize an existing repository only when `<project-root>/.git` exists as a directory or file. When it exists, verify that `git -C <project-root> rev-parse --show-toplevel` resolves to the same canonical root. Stop and report an unsafe mismatch.
3. For an existing repository, record the current branch, operation state, `git status --short`, staged paths, unstaged paths, untracked paths, and relevant diffs. Do not alter the user's index while recording the baseline.
4. Do not create a routine task commit during an unresolved merge, rebase, cherry-pick, revert, or detached-HEAD state. Let a task explicitly handling that Git operation own its completion; otherwise report the condition.
5. When the project root has no `.git`, initialize exactly there with `git init -b main`. Never initialize a parent or child directory.

For a newly initialized repository with existing files:

1. Inspect the complete file list and create or minimally extend `.gitignore` for the detected stack. Exclude local environment files, credentials and private keys, dependency directories, caches, logs, generated output, and build artifacts. Preserve deliberate example files such as `.env.example`.
2. Review every candidate before staging. Do not stage secrets, unexpectedly large binaries, generated dependencies, or files outside the project root.
3. Stage the reviewed baseline. This is the only phase where `git add -A` is allowed, and only after the safety review and ignore rules are in place.
4. Inspect the staged names and diff, then create a baseline commit in the applicable repository format and language (for example `chore: 初始化 Git 仓库`) when committable files exist. Do not create an empty baseline commit.
5. If Git identity, hooks, or another Git error prevents the baseline commit, do not bypass it or invent identity values. Continue the requested work when safe, but report that automatic committing is blocked.

## Review task-created artifacts

Perform this review after implementation and verification and before staging a task commit:

1. Build a complete inventory of paths created, modified, renamed, or deleted by the current task. Compare task activity with the recorded baseline and inspect the final status with untracked paths expanded. Include task-created paths that an existing ignore rule already hides. Do not treat files that were already untracked or dirty at baseline as task-owned.
2. Classify every task-owned path as either a required project change or a local-only artifact. Treat test packages, build output, dependency directories, caches, logs, temporary files, editor state, and plugin working files as local-only unless the user request or established repository convention explicitly requires them to be versioned.
3. For each task-created, untracked local-only artifact, first run `git check-ignore -v -- <path>`. When an existing rule matches, keep that rule unchanged and do not add a duplicate.
4. When no rule matches, minimally append a rule to the project-root `.gitignore`. Preserve all existing content and user edits. Use a root-anchored exact path for a single artifact or an uncertain classification; use a directory-level rule only when the directory is a confirmed conventional output location for the detected tool. Never add a broad wildcard that could hide source files.
5. Run `git check-ignore -v -- <path>` again for every new rule and confirm that it matches the intended artifact. Keep the ignored artifact on disk; do not delete it.
6. Treat only the lines added to `.gitignore` by this task as task-owned. Include those lines in the task commit. If `.gitignore` was dirty at baseline, stage only clearly separable task lines; if they cannot be isolated safely, do not create the task commit and explain why.
7. When a local-only artifact was already tracked at baseline, do not add an ineffective ignore rule, run `git rm --cached`, or stage its task-time modification. Leave it tracked, report it as an uncommitted issue, and let the user decide whether to change the repository policy.
8. Repeat the candidate-path review after updating `.gitignore`. Confirm that every task-created path is either selected for the commit, demonstrably ignored, or explicitly reported as an already tracked artifact.

## Finish and isolate task changes

Complete the requested implementation and its proportionate verification before committing.

1. Compare the final state with the recorded baseline. If the task produced no project-file changes, do not create a commit.
2. Select only required project files, task-owned hunks, and task-owned `.gitignore` additions identified by the artifact review. Exclude unrelated user changes and all local-only artifacts. Do not use `git add .` or `git add -A` for a task commit.
3. When a task touches a file that was already dirty, stage only clearly separable task hunks. If any required task change cannot be separated reliably, do not create an incomplete or mixed commit; leave the task changes uncommitted and explain the conflict.
4. Preserve unrelated staged entries. When unrelated content is already staged and the task paths are wholly task-owned, use a path-limited commit such as `git commit --only ... -- <task-paths>` so the existing index content is not included.
5. Inspect task-scoped staged names, `git diff --cached --check`, the diff stat, and the actual diff. Confirm that the commit contains the complete task and its required ignore rules, contains no local-only artifact, and includes nothing else.

## Write the commit message

Follow the user and target repository conventions, including language, allowed types, scope, and any enforced format. If none exist, use a concise `<type>: <description>` title in the user’s language, without trailing punctuation. Use an optional scope only when it helps identify the module. Choose the type that best represents the primary user-visible outcome:

- `feat`: add capability or behavior
- `fix`: correct a defect
- `refactor`: restructure code without changing behavior
- `perf`: improve performance
- `test`: change tests only
- `docs`: change documentation only
- `build`: change dependencies or build tooling
- `ci`: change continuous-integration configuration
- `style`: change formatting only
- `chore`: perform maintenance not covered above
- `revert`: revert an earlier change

Keep the subject concise and specific, for example `feat: 添加批量导出功能` or `fix: 修复登录状态丢失问题`.

Run normal Git hooks. Never use `--no-verify`, create an empty commit, amend an existing commit, rewrite history, or push unless the user explicitly asks. If a hook fails, fix only in-scope failures, re-stage the task changes, and retry; otherwise leave the changes uncommitted and report the failure.

## Report the result

After a successful commit:

1. Read the short commit hash and subject from `HEAD`.
2. Run `git status --short` and distinguish remaining user changes from task leftovers.
3. Report the hash, commit subject, verification performed, ignore rules added or reused for task-created artifacts, any tracked artifacts left uncommitted, and any other remaining uncommitted changes.

If no commit was created, state the exact reason. Never claim success from `git commit` output without verifying `HEAD`.
