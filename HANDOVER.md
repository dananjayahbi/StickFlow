# StickFlow handover

StickFlow is a detached, rebranded, locally working copy of an MIT-licensed
stickman-video project. It is configured and verified for **B · Code Engine**:
script, artwork, animation, captions, sound and rendering all run on this PC.

No video-model account, API key or generation credits are needed for B.

## Status

| Item | Result |
| --- | --- |
| Location | `E:\My_GitHub_Repos\StickFlow` |
| Upstream remote | removed (fresh local Git repository) |
| Upstream branding/links | removed (verified by `tests/verify-brand-isolation.py`) |
| Skill ID | `stickflow` |
| OpenCode install | `C:\Users\Tuf\.config\opencode\skills\stickflow` (junction) |
| Node runtime | installed in `skills\stickflow\node_modules` |
| Doctor (B1–B4) | pass |
| Doctor (B6 Python) | pass |
| Node runtime tests | 574 tests: 573 pass, 1 platform skip, 0 fail |
| Python runtime tests | all pass |
| End-to-end B1 render | pass — 16.4 s, 1280×720, 30 fps, H.264 + AAC |
| End-to-end B5 render | pass — 10 s, 1920×1080, 30 fps, silent stage demo |

## Quick start (B only)

```powershell
cd E:\My_GitHub_Repos\StickFlow

# One-time setup
powershell -ExecutionPolicy Bypass -File scripts\setup-stickflow.ps1

# Re-check the local toolchain
node skills\stickflow\scripts\autopilot.mjs doctor

# Render the bundled B1 demo (16.4 s with narration)
powershell -ExecutionPolicy Bypass -File scripts\render-b1-demo.ps1
```

Demo output: `output\StickFlow-B1-demo.mp4`

## Create a new video with the agent

Open a conversation and ask for B mode, for example:

```text
Use Code Engine (B) in StickFlow to turn this idea into a stickman video:
[your topic or script]

Requirements: 16:9 landscape, 30 seconds, style B1 "Minimal Line Art",
voiceover, captions and sound effects.
First give me the script and a 20-second preview with audio.
After I approve, render the complete video locally.
```

The agent reads `skills/stickflow/SKILL.md`, authors the project outside the
Skill folder, and runs:

```powershell
node skills\stickflow\scripts\autopilot.mjs init <project-dir> --style B1 --ratio 16:9
node skills\stickflow\scripts\autopilot.mjs validate <project-dir>
node skills\stickflow\scripts\autopilot.mjs preview  <project-dir> --seconds 20
node skills\stickflow\scripts\autopilot.mjs approve  <project-dir> --note "..." --visual-review <review.json>
node skills\stickflow\scripts\autopilot.mjs render   <project-dir>
```

`preview` is the normal approval gate. For a quick technical check without an
approval record, run `preview` with the full duration; it produces the complete
MP4 in `<project-dir>\output\preview.mp4`.

## B styles available

| Style | Name | Local pipeline |
| --- | --- | --- |
| B1 | Minimal Line Art | manifest renderer |
| B2 | Colorful Hand-Drawn | manifest renderer |
| B3 | Retro TV | manifest renderer + semantic motion |
| B4 | Survival Thriller | manifest renderer + picture/text reviews |
| B5 | Avatar Explainer | code-authored scene + encoder |
| B6 | Meme Story Animation | painted-world Python renderer |
| B7 | Pixel Theater | project-local pixel code |

## Verification commands

```powershell
# Everything (brand, Node tests, Python tests, repository checks)
powershell -ExecutionPolicy Bypass -File scripts\verify-stickflow.ps1

# Individual suites
npm test --prefix skills\stickflow
python tests\verify-brand-isolation.py
python skills\stickflow\tests\b6_production_test.py
```

## Environment

- Node.js 24.11.1
- FFmpeg / FFprobe on `PATH`
- Python 3.14 with NumPy, Pillow and OpenCV
- Optional variables: `FFMPEG`, `FFPROBE`, `AUTOPILOT_FONT`, `B6_PYTHON`
- `GEMINI_API_KEY` is **not** required for B and is not configured

## Notes

- A · Model Engine needs paid video-model access. It is left in the
  documentation for reference but is not required or tested here.
- The bundled A/B sample videos are historical references. Creating a new film
  must author new story-specific artwork and motion.
- `output/` and `demo/` are local working folders.
- The large `assets/`, `docs/` and `skills/` trees are intentionally listed in
  `.gitignore`, as requested, so Git tracks only the small root project files.
