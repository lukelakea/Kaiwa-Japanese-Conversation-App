# Kaiwa (会話) — Japanese Conversation Practice

A local-first Japanese conversation-practice app. Hold a natural back-and-forth
in Japanese with an AI partner running entirely on your own machine (via
[Ollama](https://ollama.com)) — no subscription, no required sign-up, no cloud.

> **Status:** Phases 0–1 complete — a working, settings-aware text conversation.
> Reading aids, feedback, scenario modes, and voice are planned (see
> `PROJECT_BRIEF`).

## Features (so far)

- Streaming Japanese conversation with a local LLM.
- Three behaviour controls, **adjustable mid-conversation**:
  - **Difficulty** — Beginner · Intermediate · Advanced · Near-Fluent
  - **Register** — Casual · Friendly · Polite · Formal
  - **Initiative** — AI-led · Balanced · User-led
- Dark, minimal UI tuned for Japanese legibility (Noto Sans JP).
- Clean LLM **provider abstraction** — a second provider (e.g. Anthropic) can be
  added later without touching feature code.

## Tech stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS v4
- **Backend:** Python + FastAPI (managed with [uv](https://docs.astral.sh/uv/))
- **LLM:** Ollama (local). Default model `gemma3:27b`.

## Prerequisites

Install and have these available on your PATH:

| Tool | Notes |
|------|-------|
| [Node.js](https://nodejs.org) 20+ | frontend |
| [Python](https://www.python.org) 3.12+ | backend |
| [uv](https://docs.astral.sh/uv/) | Python env/deps |
| [Ollama](https://ollama.com) | running locally |

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
# Install root, frontend, and backend dependencies
npm run setup
```

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

Make sure Ollama is running and the configured model is pulled first.

To run them separately: `npm run dev:backend` and `npm run dev:frontend`.

## Configuration

Backend settings are read from `backend/.env` (prefix `KAIWA_`). Defaults work
out of the box; see `backend/.env.example` for the full list. Common overrides:

| Variable | Default | Purpose |
|----------|---------|---------|
| `KAIWA_OLLAMA_MODEL` | `gemma3:27b` | Ollama model used for replies |
| `KAIWA_OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `KAIWA_TEMPERATURE` | `0.7` | Sampling temperature |
| `KAIWA_CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origin(s) |

Frontend: `VITE_API_BASE_URL` (default `http://localhost:8000`) in
`frontend/.env.local`.

## Scripts

| Command (repo root) | Does |
|---------------------|------|
| `npm run setup` | Install all dependencies |
| `npm run dev` | Run backend + frontend |
| `npm run build` | Build the frontend |
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

## Project structure

See [`CLAUDE.md`](CLAUDE.md) for the directory layout and engineering
conventions, and `PROJECT_BRIEF` for the full product vision and phase plan.
