# Contributing to StickFlow

StickFlow is a personal, self-contained stickman video studio for AI agents. All work happens inside this repository; there is no external account, hosted service or upstream repository involved.

## Repository layout

```text
skills/stickflow/   The Skill itself (this is what an agent loads)
  SKILL.md                          Entry point the agent reads first
  references/                       Per-style and per-workflow instructions
  scripts/                          Code Engine (B) runtime and helpers
  assets/                           Approved references, fonts and the B-mode sound library
  tests/                            Node and Python tests for the runtime
tests/                              Repository checks
docs/                               Asset license archive and supporting notes
scripts/                            Maintenance helpers
```

There is only one Skill. Do not add a second `SKILL.md` anywhere; the tests reject it.

## Setting up

- **Node.js 20+** and **FFmpeg/FFprobe** for the Code Engine (B) runtime.
- **Python 3.9+** with Pillow and NumPy for the Python helpers; some B6 tools also use OpenCV (`opencv-python`).

```powershell
npm install --prefix skills/stickflow
node skills/stickflow/scripts/autopilot.mjs doctor
```

Optional environment variables: `FFMPEG`, `FFPROBE`, `AUTOPILOT_FONT`, `GEMINI_API_KEY` (only for the optional Gemini adapters), `B6_PYTHON`.

## Running the checks

From the repository root:

```powershell
# Runtime test suite
npm test --prefix skills/stickflow

# Python runtime and helper tests
python tests/b6_asset_isolation_test.py
Get-ChildItem skills\stickflow\tests\*.py | ForEach-Object { python $_.FullName }

# Repository checks
Get-ChildItem tests\verify-*.py | ForEach-Object { python $_.FullName }

# Brand isolation (no upstream repository references)
python tests/verify-brand-isolation.py
```

A full render check is available through the bundled example:

```powershell
node skills/stickflow/scripts/autopilot.mjs render skills/stickflow/examples/b1/project.json
```

## Ground rules

1. **Keep approved samples and references unchanged.** Approved sample videos, reference images, prompts and their fingerprints are checked by tests. Update them only for a deliberate, reviewed change.
2. **Keep existing IDs and paths.** Style IDs (A1–A8, B1–B7), file paths, anchors and commands (including the `autopilot` file names) are used by agents and tests. Rename only when that is the point of the change, and update every reference.
3. **Only add media you have the rights to.** Record the source, license and required credit for every image, font, voice, music track or sound effect, following the existing `CREDITS.md` files and [music sourcing and license](skills/stickflow/references/music-sourcing-and-license.md).
4. **Never commit secrets.** API keys and tokens belong in your local `.env`, which is ignored by git.
5. **Technical checks are not visual approval.** If your change affects how videos look or sound, say what you actually watched and listened to, and attach a short clip or frames if you can.
6. **Keep the repository detached.** Do not re-add remotes, badges, sponsor blocks or links that point at another project's repository.
