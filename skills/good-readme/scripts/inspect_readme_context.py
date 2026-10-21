#!/usr/bin/env python3
"""Collect read-only README decision evidence for one explicit project path."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


PROJECT_MARKERS = (
    "AGENTS.md",
    "package.json",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "Gemfile",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "Makefile",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    ".env.example",
    "LICENSE",
    "LICENSE.md",
)


def run_git(project: Path, *args: str) -> tuple[int, str]:
    try:
        completed = subprocess.run(
            ["git", "-C", str(project), *args],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            env={**os.environ, "GIT_OPTIONAL_LOCKS": "0"},
        )
    except FileNotFoundError:
        return 127, ""
    # Preserve whitespace in NUL-delimited filenames and repository paths.
    return completed.returncode, os.fsdecode(completed.stdout)



def parse_status_z(raw: str) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    parts = raw.split("\0")
    index = 0
    while index < len(parts):
        item = parts[index]
        if not item:
            index += 1
            continue
        status = item[:2]
        path = item[3:] if len(item) > 3 else ""
        record = {"status": status, "path": path}
        if "R" in status or "C" in status:
            if index + 1 < len(parts) and parts[index + 1]:
                record["source_path"] = parts[index + 1]
                index += 1
        records.append(record)
        index += 1
    return records


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: inspect_readme_context.py <absolute-project-path>", file=sys.stderr)
        return 2

    requested = Path(sys.argv[1]).expanduser()
    if not requested.is_absolute():
        print("Project path must be absolute", file=sys.stderr)
        return 2
    project = requested.resolve()
    if not project.is_dir():
        print(f"Project directory does not exist: {project}", file=sys.stderr)
        return 2

    readmes = sorted(
        path.name
        for path in project.iterdir()
        if path.is_file() and path.name.lower().startswith("readme")
    )
    markers = [name for name in PROJECT_MARKERS if (project / name).exists()]
    top_level = sorted(path.name for path in project.iterdir())[:80]

    git_code, git_root_raw = run_git(project, "rev-parse", "--show-toplevel")
    git_root = Path(git_root_raw.removesuffix("\n")).resolve() if git_code == 0 and git_root_raw else None
    git_scope = "none"
    status: list[dict[str, str]] = []
    if git_root:
        git_scope = "project" if git_root == project else "ancestor"
        status_code, status_raw = run_git(
            project,
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
            "--",
            ".",
        )
        if status_code == 0:
            status = parse_status_z(status_raw)

    result = {
        "project_path": str(project),
        "readme_md_exists": (project / "README.md").is_file(),
        "readme_candidates": readmes,
        "project_markers": markers,
        "top_level_entries": top_level,
        "git": {
            "root": str(git_root) if git_root else None,
            "scope": git_scope,
            "warning": (
                "Git root is outside the opened project; keep all decisions and writes scoped to project_path."
                if git_scope == "ancestor"
                else None
            ),
            "status_in_project": status,
        },
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
