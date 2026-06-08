# CLAUDE.md — Kaiwa project conventions

Conventions and guardrails for working in this repo. Read before making changes.
Kaiwa is a local-first Japanese conversation-practice app, built both as a
personal study tool and as a portfolio project — **treat all code as if a senior
engineer will review it.**

## Non-negotiable principles

- **Local-first.** v1.0 must run fully locally against Ollama, with no cloud
  dependency required to use the app.
- **Provider abstraction is sacred.** Feature code talks only to the
  `LLMProvider` interface (`backend/app/llm/base.py`). Never import a concrete
  provider outside `backend/app/llm/factory.py`. Adding Anthropic later must be a
  new provider module + one line in the factory, touching no feature code.
- **Code quality is a deliverable.** Modular, well-typed, separation of concerns.
  No dead code. Meaningful names. Comments explain *why*, not *what*.
- **Windows-first tooling.** The developer is on Windows. All commands must work
  in PowerShell/cmd — never assume bash. Prefer cross-platform npm scripts.
- **Dark, minimal UI.** Clean and uncluttered. Prioritise Japanese legibility
  (Noto Sans JP, generous sizing, roomy line height via the `.jp-text` class).
- **Honest assessment.** If something is a bad idea or there's a better way, say
  so before building. Don't silently comply or silently override.

## Layout

```
backend/    FastAPI app (uv-managed). Owns the LLM abstraction, prompt
            composition, and the conversation API.
  app/
    llm/        Provider interface + Ollama implementation + factory.
    models/     Pydantic API models (mirror the frontend TS types).
    prompts/    System-prompt composition from settings/mode.
    api/        FastAPI routers.
    config.py   Env-driven settings (KAIWA_ prefix).
  scripts/    Dev utilities (e.g. eval_models.py — model A/B harness).
frontend/   React + Vite + TS + Tailwind v4. Dark chat UI.
  src/
    api/        Typed client (streaming fetch).
    components/ chat/, settings/, layout/, ui/ — small focused components.
    config/     Data-driven UI metadata (e.g. settings options).
    hooks/      useConversation (conversation state), useClickOutside.
    types/      TS domain types (mirror backend models).
```

## Conventions

- **Backend:** Python 3.12+, FastAPI, async throughout. Format/lint with ruff
  (`npm run lint:backend` / `format:backend`). Settings via `pydantic-settings`,
  `KAIWA_`-prefixed env vars; never hardcode the model name or URLs.
- **Frontend:** TypeScript strict. ESLint + Prettier (`npm run lint` / `format`
  in `frontend/`). No inline styles — Tailwind utilities only; extract repeated
  patterns into components. Keep the backend models and `src/types` in sync.
- **The model is configurable** (`KAIWA_OLLAMA_MODEL`). Default is `gemma3:27b`
  (it stays reliably in Japanese; qwen2.5:32b code-switches to Chinese). Don't
  hardcode model assumptions.
- **Settings → prompt only.** Difficulty / register / initiative are composed
  into the system prompt in `backend/app/prompts/` — never separate models or
  pipelines. All three are adjustable mid-conversation (affect the next turn).
- **Reply pipeline (per the brief §6):** the Japanese reply is one LLM call;
  furigana/readings will be deterministic (kuromoji, Phase 2), not LLM-generated;
  translation is a separate opt-in call (Phase 2). Don't ask one call to return
  Japanese + furigana + translation together.

## Phase status

Phases build in order; stop at each for review. **Phases 0–1 are complete**
(scaffold, provider abstraction, streaming text conversation, the three
settings, Free Talk only). Not yet built: reading aids (2), feedback (3),
modes (4), voice (5). See `PROJECT_BRIEF` for the full plan. Architecture should
accommodate these without rearchitecting.

## Running

`npm run setup` once, then `npm run dev` (runs backend + frontend together).
Requires Ollama running locally with the configured model pulled. See README.
