# StickFlow Studio

Studio is the local management layer around the verified B renderer. It adds
configuration, organized storage, Qwen/Kokoro narration, a Next.js dashboard and
a small MCP server. The renderer and its approval gates are unchanged.

## Layers

```text
skills/stickflow/scripts/autopilot.mjs     B renderer (unchanged)
skills/stickflow/scripts/tts.mjs           unified narration router
skills/stickflow/scripts/qwen_tts_engine.py Qwen3-TTS on StoryFlow's venv
studio/lib/                                 config, storage, metadata, voices
studio/cli.mjs                              command-line Studio
studio/app/                                 Next.js dashboard
studio/mcp/server.mjs                       stdio MCP server
stickflow.config.json                       single source of truth
```

## Commands

```powershell
# Config, engine health, storage counts
node studio\cli.mjs context
node studio\cli.mjs context --json
node studio\cli.mjs doctor

# Create a project inside Storage/Videos or Storage/Shorts
node studio\cli.mjs new "The Great Pyramid" --style B1 --ratio 16:9

# Narration: Qwen by default, Kokoro available
node skills\stickflow\scripts\tts.mjs --out-dir <project> --text-file <project>\script.txt --captions
node skills\stickflow\scripts\tts.mjs --engine kokoro --text "Hello" --output hello.wav --words-out words.json

# Projects
node studio\cli.mjs list
node studio\cli.mjs status great-pyramid
node studio\cli.mjs register great-pyramid --status approved

# Reference voices
node studio\cli.mjs voices add --name "Morgan" --audio C:\voices\morgan.wav --text "Exact transcript"
node studio\cli.mjs voices list
node studio\cli.mjs voices preset --speaker Aiden

# Migration
node studio\cli.mjs migrate-legacy
node studio\cli.mjs migrate-legacy --apply

# Dashboard
powershell -ExecutionPolicy Bypass -File ..\scripts\start-studio.ps1
# or: cd studio; npm run dev / npm run build / npm run start
# http://127.0.0.1:57321
```

## Storage

```text
Storage/
  Videos/<project-id>/      native 16:9
  Shorts/<project-id>/      native 9:16
  _library/
    voices/<voice-id>/      reference audio + voice.json
    migrations/             SHA-256 migration manifests
```

Each project keeps:

```text
project.json               engine contract (untouched)
project-meta.json          Studio metadata
script.txt
narration.wav
words.json
captions.json
generation.json            engine, voice, speed, timings
assets/
source/
output/
  film.mp4
  preview.mp4
  poster.jpg
  film-contact-sheet.png
  film-report.json
```

`project-meta.json` is a sidecar. B1–B3 hash `project.json` as a fingerprint, so
dashboard fields never enter the engine manifest.

## Narration

`stickflow.config.json` controls the default engine (`qwen`), Qwen mode
(`custom_voice` or `clone`), speaker, reference audio, and the Kokoro fallback.

Qwen uses StoryFlow's existing Python 3.11 venv:

`E:\My_GitHub_Repos\storyFlow\backend\qwen_tts\.venv\Scripts\python.exe`

The weights stay in the shared Hugging Face cache and narration runs with
`HF_HUB_OFFLINE=1`. A GPU lock serializes Qwen with StoryFlow. Timings are
sentence spans snapped to real silences, then proportional word estimates; they
are not forced alignment.

Kokoro remains the fast CPU fallback and can be selected in the dashboard or
with `config set tts.defaultEngine kokoro`.

## Dashboard

- **Overview** — engine health, default voice, project counts, storage, recent cuts.
- **Gallery** — visual grid with search and section/status/style filters.
- **Projects** — management table for every registered project.
- **Project detail** — player, metadata, artifacts, publish state, scheduling.
- **Publish planner** — month calendar, scheduled/unscheduled/published lists.
- **Settings** — default engine, Qwen preset/clone, reference upload, Kokoro voice.

Media is streamed through `/api/media/...` with byte-range support and a
storage-root path guard. The dashboard is local-only.

## MCP

The server is registered in OpenCode as `stickflow`. Tools:

| Tool | Purpose |
| --- | --- |
| `stickflow_status` | engine, storage, counts, recent projects |
| `stickflow_list_projects` | filtered gallery listing |
| `stickflow_get_project` | metadata and artifact inventory |
| `stickflow_publish_project` | register a rendered project in the gallery |
| `stickflow_planner` | scheduled/unscheduled/published |
| `stickflow_set_default_tts` | change engine, mode, speaker or Kokoro voice |
| `stickflow_reindex` | refresh one or all project metadata files |

MCP does not render or author videos. Rendering stays in the project folder with
`autopilot.mjs`.

## Tests

```powershell
node --test studio\tests\*.test.mjs
```

Qwen and Kokoro have also been exercised end-to-end with real audio on this PC.

