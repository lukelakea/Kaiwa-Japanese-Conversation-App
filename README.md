# Kaiwa (会話) — Japanese Conversation Practice

A local-first Japanese conversation-practice app. Hold a natural back-and-forth
in Japanese with an AI partner running entirely on your own machine (via
[Ollama](https://ollama.com)) — no subscription, no required sign-up, no cloud.

> **Status:** v1.0 complete — settings-aware text **and** voice conversation,
> reading aids (furigana, hover dictionary, translation, vocab save), inline
> feedback on your Japanese, and scenario modes. See `PROJECT_BRIEF.md` for the
> full vision and `STATE.md` for the build log.

![Kaiwa — dark chat UI with a Japanese reply, furigana, and an inline feedback annotation](docs/screenshot.png)

## Features

- **Streaming Japanese conversation** with a local LLM, with full history kept in
  context each turn.
- **Three behaviour controls, adjustable mid-conversation:**
  - **Difficulty** — Beginner · Intermediate · Advanced · Near-Fluent
  - **Register** — Casual · Friendly · Polite · Formal
  - **Initiative** — AI-led · Balanced · User-led
- **Conversation modes:** open-ended **Free Talk**, ten curated **Scenarios**
  (restaurant, hotel check-in, job interview, …), and **Generated** scenarios
  spun up by the model from an optional theme.
- **Reading aids** (opt-in, off by default):
  - **Furigana** over kanji, generated deterministically with SudachiPy.
  - **Hover-lookup** — word definitions (JMdict) and per-kanji readings/meanings
    (KANJIDIC2), served locally, no LLM call.
  - **Translation** of any reply to English (a separate, on-demand LLM call).
  - **Quick vocab save** — one-click save of a word to your browser.
- **Inline feedback** — each message you send gets a collapsible, non-intrusive
  critique (in English, with the corrected Japanese), judged against the register
  you're practising. Grammar corrections can be saved for review.
- **Voice** — speak your turn (speech-to-text via faster-whisper) and have replies
  read aloud (text-to-speech via VOICEVOX). Both are optional; typing always works.
- Dark, minimal UI tuned for Japanese legibility (Noto Sans JP).
- Clean LLM **provider abstraction** — a second provider (e.g. Anthropic) can be
  added later without touching feature code.

## Tech stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS v4 (tested with Vitest)
- **Backend:** Python + FastAPI (managed with [uv](https://docs.astral.sh/uv/),
  tested with pytest)
- **LLM:** Ollama (local). Default model `gemma3:27b`.
- **Japanese tooling:** [SudachiPy](https://github.com/WorksApplications/SudachiPy)
  (tokenisation + furigana), [JMdict](https://github.com/scriptin/jmdict-simplified)
  + KANJIDIC2 (dictionary), compiled into a local SQLite file.
- **Voice:** [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (STT) and
  [VOICEVOX](https://voicevox.hiroshiba.jp/) (TTS).

## Prerequisites

Install and have these available on your PATH:

| Tool | Required for | Notes |
|------|--------------|-------|
| [Node.js](https://nodejs.org) 20+ | everything | frontend |
| [Python](https://www.python.org) 3.12+ | everything | backend |
| [uv](https://docs.astral.sh/uv/) | everything | Python env/deps |
| [Ollama](https://ollama.com) | everything | running locally |
| [VOICEVOX](https://voicevox.hiroshiba.jp/) | voice output (optional) | local TTS engine on `:50021` |
| [ffmpeg](https://ffmpeg.org/) | voice input (optional) | decodes browser audio for STT |

Pull the conversation model (one-time):

```powershell
ollama pull gemma3:27b
```

> **Model choice.** `gemma3:27b` is the default because it stays reliably in
> Japanese. `qwen2.5:32b` has excellent Japanese too but intermittently
> code-switches to Chinese mid-reply, so it's not the default. To try a different
> model, pull it and set `KAIWA_OLLAMA_MODEL` (see Configuration).

## Setup

From the repo root (PowerShell):

```powershell
# Install all dependencies AND build the reading-aids dictionary
npm run setup
```

`npm run setup` also downloads JMdict + KANJIDIC2 and compiles them into
`backend/data/dictionary.sqlite` (a few hundred MB are downloaded once; the file
is git-ignored). To rebuild it later — e.g. for a newer dictionary release — run
`npm run setup:dict`. The app runs without it, but hover-lookup will be empty
until it exists.

Optionally create env files from the examples to override defaults:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env.local
```

## Running

Start the backend and frontend together:

```powershell
npm run dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:8000  (health: `/api/health`)

Make sure Ollama is running and the configured model is pulled first. For voice
output, start VOICEVOX too (the TTS button degrades gracefully if it's absent).

To run them separately: `npm run dev:backend` and `npm run dev:frontend`.

## Testing

Unit tests cover the parts that benefit most from being pinned: system-prompt
composition, the furigana alignment heuristic, the defensive JSON parsing in the
feedback/scenario endpoints, the typed API client, and the conversation hook's
parallel feedback/reply dispatch. None of them require a live model, VOICEVOX, or
the compiled dictionary.

```powershell
npm test            # frontend (Vitest) + backend (pytest)
npm run test:frontend
npm run test:backend
```

## Configuration

Backend settings are read from `backend/.env` (prefix `KAIWA_`). Defaults work
out of the box; see `backend/.env.example` for the full list. Common overrides:

| Variable | Default | Purpose |
|----------|---------|---------|
| `KAIWA_OLLAMA_MODEL` | `gemma3:27b` | Ollama model used for replies |
| `KAIWA_OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `KAIWA_TEMPERATURE` | `0.7` | Sampling temperature |
| `KAIWA_TRANSLATION_TEMPERATURE` | `0.3` | Temperature for the translation pass |
| `KAIWA_FEEDBACK_TEMPERATURE` | `0.3` | Temperature for the feedback pass |
| `KAIWA_DICTIONARY_PATH` | `data/dictionary.sqlite` | Compiled JMdict + KANJIDIC2 DB |
| `KAIWA_CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origin(s) |
| `KAIWA_VOICEVOX_BASE_URL` | `http://localhost:50021` | VOICEVOX local HTTP API |
| `KAIWA_VOICEVOX_SPEAKER` | `1` | VOICEVOX speaker ID |
| `KAIWA_WHISPER_MODEL` | `base` | faster-whisper model size |
| `KAIWA_WHISPER_DEVICE` | `cuda` | faster-whisper device (`cuda` or `cpu`) |

Frontend: `VITE_API_BASE_URL` (default `http://localhost:8000`) in
`frontend/.env.local`.

## Scripts

| Command (repo root) | Does |
|---------------------|------|
| `npm run setup` | Install all dependencies + build the dictionary |
| `npm run setup:dict` | (Re)build the reading-aids dictionary only |
| `npm run dev` | Run backend + frontend |
| `npm run build` | Build the frontend |
| `npm test` | Run frontend + backend tests |
| `npm run lint` | Lint frontend (ESLint) + backend (ruff) |
| `npm run format` | Format frontend (Prettier) + backend (ruff) |

Backend model A/B harness (compares models for Japanese fidelity):

```powershell
uv run --directory backend python scripts/eval_models.py
```

## Known limitations (v1.0)

- Very long sessions will eventually approach the model's context window; the
  full history is sent each turn (no summarisation yet). Acceptable for v1.0.
- Switching register *mid-conversation* shifts the next reply's tone but may be
  gradual, since the model also honours the existing conversation's register.
- Feedback and generated-scenario quality depend on the local model's judgement;
  the response *shape* is enforced, the linguistic judgement is not.

## Project structure

See [`CLAUDE.md`](CLAUDE.md) for the directory layout and engineering
conventions, and `PROJECT_BRIEF.md` for the full product vision and phase plan.

## License

[MIT](LICENSE) © 2026 Luke Lakea.
