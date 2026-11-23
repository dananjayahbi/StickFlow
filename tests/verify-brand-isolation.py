#!/usr/bin/env python3
"""Verify StickFlow is detached from the upstream repository and consistently branded.

Sample media under skills/stickflow/assets is intentionally preserved byte-for-byte
and is excluded from the text scan. LICENSE keeps the upstream MIT attribution.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
TEXT_EXTS = {".md", ".mjs", ".cjs", ".js", ".py", ".json", ".yml", ".yaml", ".sh", ".txt", ".toml"}
SKIP_DIRS = {".git", "node_modules", "__pycache__"}
SKIP_PREFIXES = [ROOT / "skills" / "stickflow" / "assets"]
FORBIDDEN = (
    "kaomei",
    "Kaomei",
    "stickman-video-director",
    "CrazyKaomei",
    "AveryRunsAI",
    "README.zh-CN.md",
    "README.en.md",
    "star-history.com",
    "telegram.me",
)


def is_text(path: Path) -> bool:
    return path.suffix.lower() in TEXT_EXTS or path.name in {"LICENSE", ".gitignore", ".gitattributes"}


def iter_files():
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if any(str(path).startswith(str(prefix) + "\\") or path == prefix for prefix in SKIP_PREFIXES):
            continue
        if path.resolve() == Path(__file__).resolve():
            continue
        if is_text(path):
            yield path


violations = []
for path in iter_files():
    text = path.read_text(encoding="utf-8", errors="ignore")
    for token in FORBIDDEN:
        if token in text:
            # The MIT license must preserve the original copyright notice.
            if token == "stickman-video-director" and path.name == "LICENSE":
                continue
            line = next((i for i, value in enumerate(text.splitlines(), 1) if token in value), 0)
            violations.append(f"{path.relative_to(ROOT)}:{line}: {token}")

assert not violations, "Upstream references remain:\n" + "\n".join(violations)

readme = (ROOT / "README.md").read_text(encoding="utf-8")
assert "# 🎬 StickFlow" in readme.splitlines(), "README title must be StickFlow"
assert "kaomei" not in readme and "jsdelivr" not in readme, "README must not link externally hosted project media"

skill = (ROOT / "skills" / "stickflow" / "SKILL.md").read_text(encoding="utf-8")
assert re.search(r"^name:\s*stickflow\s*$", skill, re.M), "SKILL.md must use the stickflow id"
assert "StickFlow" in skill.split("---", 2)[1], "SKILL.md description must mention StickFlow"

assert (ROOT / "skills" / "stickflow" / "scripts" / "autopilot.mjs").is_file()
assert (ROOT / "skills" / "stickflow" / "examples" / "b1" / "project.json").is_file()
print("Brand isolation passed.")
