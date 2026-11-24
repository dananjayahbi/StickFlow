# StickFlow Studio

The Studio layer wraps the verified B renderer without changing it. It owns
configuration, storage, project metadata, and (in later phases) the dashboard
and MCP server.

## Phase 1 — foundation

| Piece | Location |
| --- | --- |
| Canonical config | `stickflow.config.json` |
| Studio CLI | `studio/cli.mjs` |
| Config loader | `studio/lib/config.mjs` |
| Storage helpers | `studio/lib/storage.mjs` |
| Metadata/artifacts | `studio/lib/metadata.mjs` |
| Legacy migration | `studio/lib/migrate.mjs` |
| Tests | `studio/tests/*.test.mjs` |

## Commands

```powershell
# Resolved config, engine health, storage counts
node studio\cli.mjs context
node studio\cli.mjs context --json

# Create a project inside Storage/Videos or Storage/Shorts
node studio\cli.mjs new "The Great Pyramid" --style B1 --ratio 16:9

# List / inspect / refresh metadata
node studio\cli.mjs list
node studio\cli.mjs status great-pyramid
node studio\cli.mjs register great-pyramid --status approved

# Safe dry run, then copy the old output/ tree into Storage/
node studio\cli.mjs migrate-legacy
node studio\cli.mjs migrate-legacy --apply

# Read and write config atomically
node studio\cli.mjs config get tts.defaultEngine
node studio\cli.mjs config set tts.defaultEngine kokoro

# Readiness checks
node studio\cli.mjs doctor
```

## Storage layout

```text
Storage/
  Videos/<project-id>/      native 16:9
  Shorts/<project-id>/      native 9:16
  _library/
    voices/<voice-id>/      reference audio + voice.json (phase 2)
    migrations/             migration manifests with SHA-256 hashes
```

Every project keeps the engine contract and all evidence together:

```text
<project-id>/
  project.json             engine manifest (untouched)
  project-meta.json        dashboard metadata
  script.txt
  narration.wav
  words.json
  captions.json
  generation.json          TTS provenance (phase 2)
  assets/
  source/
  output/
    film.mp4
    preview.mp4
    poster.jpg
    film-contact-sheet.png
```

`project-meta.json` is always a sidecar. B1–B3 hash `project.json` as a
fingerprint, so dashboard fields must never be written into the engine
manifest.

## Configuration

`stickflow.config.json` is the single source of truth. Relative paths resolve
from the repository root. The dashboard will write this file atomically.

Current defaults:

- TTS engine: `qwen`
- Qwen mode: `custom_voice`, speaker `Aiden`
- Fallback: Kokoro `bm_george`
- Qwen interpreter: StoryFlow’s existing Python 3.11 venv
- Qwen weights: existing Hugging Face cache, offline by default
- Storage sections: `Videos` / `Shorts`

## Legacy migration

`migrate-legacy` is copy-first. It never moves or deletes anything in
`output/`. The first run creates `Storage/_library/migrations/manifest-*.json`
with every copied file’s SHA-256. Re-running is idempotent.

## Next phases

2. Qwen TTS adapter, VAD sentence timings, unified `tts.mjs`, voice clone library.
3. Next.js dashboard (overview, projects, project detail, settings).
4. MCP server (status/list/get/publish/set-default/reindex only).
5. Gallery and publish planner.
6. Hardening, docs, end-to-end verification.
