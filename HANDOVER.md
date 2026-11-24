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
| New video from local TTS | pass — 6.45 s, 1280×720, 30 fps, narration + captions + SFX + ambience, zero paid credits |
| Kokoro narration | installed and used — `bm_george`, fully offline |
| Great Pyramid short | pass — 47.3 s, 1280×720, 30 fps, Kokoro narration, captions, ambience and SFX |
| Studio Phase 1 | pass — config, storage, metadata, CLI, copy-first migration, 18 tests |
| Storage layout | `Storage\Videos\<project-id>\`; old `output\` untouched |
| Default TTS | `qwen`; Kokoro remains the fallback |
| Qwen readiness | venv, CUDA and both model caches verified; no weights downloaded |

## Studio foundation (Phase 1)

`stickflow.config.json` is the single source of truth for the default TTS
engine, storage roots, dashboard settings and publishing preferences. Relative
paths resolve from the repository root.

```powershell
node studio\cli.mjs context --json   # resolved config, engine health, counts
node studio\cli.mjs list             # projects in Storage/
node studio\cli.mjs status great-pyramid
node studio\cli.mjs doctor
node studio\cli.mjs migrate-legacy   # dry run
node studio\cli.mjs migrate-legacy --apply
node --test studio\tests\*.test.mjs
```

Storage now follows the StoryFlow pattern:

```text
Storage/
  Videos/<project-id>/     native 16:9
  Shorts/<project-id>/     native 9:16
  _library/
    voices/                reference voices (phase 2)
    migrations/            manifests with SHA-256 hashes
```

Each project keeps `project.json`, `project-meta.json`, narration, captions,
source and `output/` together. `project-meta.json` is a sidecar and never enters
the engine manifest, so B1–B3 fingerprints and approvals stay valid.

The Great Pyramid was migrated to `Storage\Videos\great-pyramid-dcb17d` with
`output\film.mp4`, a poster, captions and a generated script. The original
`output\` tree was not modified. Qwen is configured as the default engine but
the TTS adapter is Phase 2; Kokoro remains fully operational.

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

Demo outputs:

- `output\StickFlow-B1-demo.mp4` — bundled 16.4 s example
- `output\StickFlow-B1-local-tts-demo.mp4` — new 6.45 s video made with the free
  local Windows voice (see below)
- `output\StickFlow-The-Great-Pyramid.mp4` — new 47.3 s ancient-history short
  narrated by Kokoro `bm_george`
- `output\great-pyramid\` — editable project, narration, words and captions

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

## Free local narration (Kokoro preferred)

Kokoro is installed in `skills/stickflow/.kokoro-venv` with its model under
`skills/stickflow/assets/kokoro`. It runs fully offline and is the preferred
voice. Example:

```powershell
skills\stickflow\.kokoro-venv\Scripts\python.exe skills\stickflow\scripts\kokoro-tts.py `
  --text-file C:\work\script.txt `
  --output C:\work\narration.wav `
  --words-out C:\work\words.json `
  --voice bm_george --speed 0.95 --pause 0.25

node skills\stickflow\scripts\autopilot.mjs captions `
  C:\work\words.json C:\work\captions.json --lead 0.15
```

Voices: `bm_george` (British male, documentary), `am_michael` (American male),
`af_sarah` (American female), `bf_emma` (British female). See
`skills\stickflow\references\kokoro-tts.md`.

### Windows SAPI fallback

The PC also has `Microsoft David Desktop` and `Microsoft Zira Desktop`.
Generate narration and word timings with:

```powershell
powershell -ExecutionPolicy Bypass -File skills\stickflow\scripts\local-tts.ps1 `
  -Text "Your approved narration here." `
  -Output C:\work\my-video\narration.wav `
  -WordsOut C:\work\my-video\words.json `
  -Voice "Microsoft Zira Desktop"

node skills\stickflow\scripts\autopilot.mjs captions `
  C:\work\my-video\words.json C:\work\my-video\captions.json --lead 0.15
```

The voice is clearly synthetic, so listen to the encoded result before delivery.
The full route is documented in `skills\stickflow\references\local-tts-windows.md`.

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
- The bundled A/B sample videos are historical references. Some retain their
  original on-screen creator watermark; they are not new-project templates, and
  new B5/B6 work must add no account watermark by default. Creating a new film
  must author new story-specific artwork and motion.
- `output/` and `demo/` are local working folders.
- The large `assets/`, `docs/` and `skills/` trees are intentionally listed in
  `.gitignore`, as requested, so Git tracks only the small root project files.
  This means a fresh `git clone` will not contain the runnable Skill or media;
  hand over this folder (or an archive of it), not the Git tree alone.
- Local commits exist on `main`. The configured remote is your personal
  `dananjayahbi/StickFlow` repository; nothing was pushed during this handover.
