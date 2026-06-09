# STATE.md — Kaiwa project snapshot

**Last updated:** end of session 2 (Phase 2).  
**Current phase:** Phase 2 complete. Next phase: Phase 3 (Feedback system).  
Read `PROJECT_BRIEF.md` for the full product vision and phase plan.

---

## How to run (Windows, fresh terminal)

**Prerequisites:** Node ≥ 20, Python ≥ 3.12, [uv](https://docs.astral.sh/uv/),
Ollama running locally with `gemma3:27b` pulled.

```powershell
# First-time setup (installs all deps + builds the reading-aids dictionary)
npm run setup

# Start backend + frontend together
npm run dev
```

`npm run setup` also runs `npm run setup:dict`, which downloads JMdict +
KANJIDIC2 and compiles `backend/data/dictionary.sqlite` (git-ignored). It is
idempotent — re-running skips the build when the DB matches the latest release.
The app runs without it (furigana still works), but hover-lookup stays empty.

- Frontend: http://localhost:5173  
- Backend:  http://localhost:8000  
- Health check: http://localhost:8000/api/health

To start them separately:

```powershell
npm run dev:backend    # FastAPI on :8000, auto-reloads on file changes
npm run dev:frontend   # Vite on :5173
```

Lint / format / build:

```powershell
npm run lint           # ESLint (frontend) + ruff check (backend)
npm run format         # Prettier (frontend) + ruff format (backend)
npm run build          # TS type-check + Vite production build
```

---

## Project structure

```
/
├── package.json              Root scripts: setup, dev, lint, format, build
├── CLAUDE.md                 Engineering conventions (read every session)
├── PROJECT_BRIEF.md          Full product vision and phase plan
├── STATE.md                  This file
├── README.md                 Setup and usage docs
│
├── backend/
│   ├── pyproject.toml        uv project config, ruff settings
│   ├── .env.example          All env vars with defaults and comments
│   ├── uv.lock
│   ├── app/
│       ├── main.py           FastAPI app factory + lifespan (provider init/close)
│       ├── config.py         Pydantic-settings, KAIWA_* prefix, lru_cache
│       ├── models/
│       │   ├── conversation.py   Domain enums + Pydantic request models (API contract)
│       │   └── reading.py        Phase 2: Token/Furigana, Word/Kanji lookup, Translate models
│       ├── llm/
│       │   ├── base.py           LLMProvider ABC, LLMMessage, GenerationOptions, LLMError
│       │   ├── ollama_provider.py  Streams /api/chat, error translation, timeout config
│       │   ├── factory.py        build_provider(settings) — only place that names providers
│       │   └── __init__.py       Re-exports the public surface
│       ├── japanese/             Phase 2: deterministic JP tooling (no LLM)
│       │   ├── tokenizer.py      SudachiPy wrapper: tokens, lemmas, furigana alignment
│       │   ├── dictionary.py     Read-only SQLite lookup (JMdict words + KANJIDIC2 kanji)
│       │   └── __init__.py       Re-exports Tokenizer, Dictionary
│       ├── prompts/
│       │   ├── system_prompt.py  compose_system_prompt(settings, mode) — all 3 settings → text
│       │   └── translation_prompt.py  TRANSLATION_SYSTEM_PROMPT for the translate pass
│       └── api/
│           ├── chat.py           POST /api/chat — peek-first stream, 502 on startup errors
│           ├── reading.py        POST /api/tokenize, GET /api/lookup (threadpool-dispatched)
│           └── translate.py      POST /api/translate — second LLM call, JSON reply, 502 on error
│   └── data/dictionary.sqlite    Compiled JMdict + KANJIDIC2 (git-ignored, built by script)
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts        Vite + @tailwindcss/vite + @vitejs/plugin-react
│   ├── tsconfig*.json        Strict TS, bundler module resolution
│   ├── eslint.config.js      ESLint 9 flat config, react-hooks, react-refresh
│   ├── .prettierrc.json
│   ├── index.html            lang="ja", dark class on <html>
│   └── src/
│       ├── main.tsx          Mounts app, imports Noto Sans JP (400/500/700) locally
│       ├── index.css         Tailwind v4 @theme tokens (surface-0/1/2, accent-400/500/600)
│       ├── App.tsx           Top-level layout: Header + SettingsBar + MessageList + input
│       ├── types/
│       │   ├── conversation.ts   TS types mirroring backend models (Message gains tokens/translation)
│       │   └── reading.ts        Phase 2: Token, FuriganaSegment, Word/Kanji entries, SavedWord
│       ├── config/
│       │   └── settings.ts   Option metadata arrays + DEFAULT_SETTINGS (data-driven)
│       ├── context/
│       │   └── SavedVocabContext.tsx  Shares the saved-vocab store (used deep in the popover)
│       ├── api/
│       │   └── client.ts     streamChat(), tokenize(), lookup(), translate(), checkHealth()
│       ├── hooks/
│       │   ├── useConversation.ts  History, streaming, send/stop/reset, tokenize + requestTranslation
│       │   ├── useSavedVocab.ts    localStorage-backed saved words (has/save/remove)
│       │   ├── useTokenLookup.ts   Cached per-token dictionary fetch (process-wide Map)
│       │   └── useClickOutside.ts  Pointer-down + Escape handler for dropdowns
│       └── components/
│           ├── chat/
│           │   ├── MessageBubble.tsx   Bubbles; renders TokenizedText + translation block
│           │   ├── MessageList.tsx     Scrolls to bottom; forwards furigana/translation props
│           │   ├── EmptyState.tsx      "会話を始めましょう" prompt
│           │   └── MessageInput.tsx    Auto-grow textarea, IME-safe Enter, send/stop button
│           ├── reading/
│           │   ├── TokenizedText.tsx   Renders tokens + furigana; orchestrates the hover popover
│           │   ├── WordPopover.tsx     Portal dictionary card (words + kanji) with save button
│           │   ├── ReadingControls.tsx Furigana/Translate toggles + Saved-words button
│           │   └── SavedVocabPanel.tsx Slide-over list of saved words
│           ├── settings/
│           │   ├── SettingDropdown.tsx  Generic dropdown, generic over value type T
│           │   └── SettingsBar.tsx      Three dropdowns composed; onChange spreads new value
│           ├── layout/
│           │   └── Header.tsx          Title + "New conversation" button (disabled if empty)
│           └── ui/
│               ├── icons.tsx     Chevron/Send/Stop + Bookmark/Close (inline SVG, currentColor)
│               ├── ToggleButton.tsx  Pill toggle used by the reading-aid switches
│               └── ErrorBanner.tsx  role="alert" strip above the input
│
└── backend/scripts/
    ├── eval_models.py    A/B harness: given model+temp combos, runs a 3-turn JP conversation
    │                     and flags any non-Japanese character leakage. Standalone (sets sys.path,
    │                     reconfigures stdout to UTF-8). Run: uv run python scripts/eval_models.py
    └── build_dictionaries.py  Downloads JMdict + KANJIDIC2 (jmdict-simplified release) and
                          compiles backend/data/dictionary.sqlite. Idempotent; `npm run setup:dict`.
```

---

## What is implemented and verified working

### Phase 0 — Scaffold & architecture ✓

- Monorepo layout with root `package.json` scripts for both halves.
- `npm run setup` installs frontend (npm) and backend (uv) deps in one command.
- `npm run dev` uses `concurrently` to run both servers.
- ESLint 9 + Prettier on the frontend; ruff (check + format) on the backend. All pass clean.
- TypeScript strict mode, `noUncheckedSideEffectImports`, `noUnusedLocals/Parameters`.
- **LLM provider abstraction** fully in place:
  - `LLMProvider` ABC with `stream_chat` (async iterator) and `complete` (derived).
  - `OllamaProvider` streams `/api/chat`, translates HTTP errors, handles connect failures.
  - `build_provider(settings)` factory is the **only** file that names a concrete provider.
  - The seam for adding Anthropic: one new provider module + one `if` in factory.
- Dark base layout, Noto Sans JP bundled locally (no network dependency).
- `CLAUDE.md` and `README.md` in place.

### Phase 1 — Core conversation loop ✓

- User types a message → backend receives full conversation history → composes system prompt → streams Ollama reply → frontend renders token-by-token.
- Full history sent every turn (brief §9). No RAG/vector DB.
- System prompt assembled from **three settings** in `compose_system_prompt()`:
  - Difficulty (beginner/intermediate/advanced/near_fluent)
  - Formality (casual/friendly/polite/formal)
  - Initiative (ai_led/balanced/user_led)
- All three are adjustable mid-conversation in the UI. Each turn's settings are sent in the request; the next reply reflects the new settings. (A setting change partway through a long conversation shifts tone gradually rather than abruptly, which is realistic model behaviour — not a bug.)
- Free Talk mode implemented. Scenario/Generated modes are enum values in the model but not yet wired (Phase 4).
- Error handling: startup errors (Ollama down, model not pulled) become HTTP 502 with a readable message shown in the `ErrorBanner`. Mid-stream errors end the stream cleanly.
- Stop-generation: abort controller cancels the in-flight fetch; a partial reply is kept if content exists, dropped if still empty.
- IME composition guard on Enter: `event.nativeEvent.isComposing` check prevents submit mid-kana conversion — essential for Japanese input.
- "New conversation" button resets history and aborts any in-flight stream.

### Phase 2 — Reading aids ✓

All five deliverables built and verified end-to-end in the browser against a
live `gemma3:27b` and the compiled dictionary:

- **Tokenisation (SudachiPy, backend).** `POST /api/tokenize` splits a reply into
  morphemes with surface, dictionary-form `lemma`, hiragana `reading`, coarse
  English `pos`, an `interactive` flag (content words/kanji vs. particles/symbols),
  and `furigana` segments. Concatenating token surfaces reproduces the input
  (newlines preserved as their own tokens). Dispatched to a threadpool; the
  tokenizer is loaded once at startup and guarded by a lock.
- **Furigana toggle.** Readings are aligned so ruby sits only over the kanji core,
  with okurigana peeled off both ends (食べ → 食[た]べ, 美味しい → 美味[おい]しい).
  Off by default; rendered with `<ruby>`/`<rt>` (accent-tinted, `.jp-ruby` CSS).
- **Hover-lookup.** `GET /api/lookup?surface=&lemma=` returns JMdict word senses
  (pos + glosses) and KANJIDIC2 per-kanji detail (on/kun, meanings, strokes,
  grade). Rendered in a portal popover so it is never clipped by the scroll
  container; one popover open at a time with a close delay so the pointer can
  travel into it. Per-token results cached process-wide.
- **Translation toggle.** `POST /api/translate` is a separate, opt-in LLM call
  (cooler temperature, dedicated system prompt) returning a single JSON string,
  shown beneath the reply. Fetched once per reply on demand; errors offer retry.
- **Quick vocab save.** One-click save from the popover to `localStorage`
  (lemma/surface/reading/glosses), with a slide-over saved-words panel. Store is
  shared via `SavedVocabContext`. Data model kept clean for future export/sync.

---

## Decisions that deviate from the brief

### 1. Default model: `gemma3:27b`, not `qwen2.5:32b`

**Brief said:** recommend a suitable chat model; developer chose `qwen2.5:32b`.

**What was found:** `qwen2.5:32b` (a Chinese-built model) intermittently code-switches to Chinese mid-reply regardless of temperature (tested 0.2, 0.4, 0.7) and regardless of explicit Japanese-only instructions in the system prompt. A full A/B harness (`eval_models.py`) confirmed:
- `qwen2.5:32b` at every temperature: multiple Chinese / English leaks per 3-turn conversation.
- `gemma3:27b` at temp 0.7 and 0.4: zero leaks, naturally idiomatic casual Japanese.

**Decision:** `gemma3:27b` is the default. The model is config-driven (`KAIWA_OLLAMA_MODEL` in `.env`), so switching is one line. `qwen2.5:32b` is fine for reading-heavy or structured tasks but is unreliable for this app's open conversation format.

### 2. Tokenization runs on the backend with SudachiPy (resolved at Phase 2 start)

**Brief said:** use `kuromoji.js`; the backend owns tokenization. A prior note in
this file leaned toward running kuromoji *client-side* (since it is a JS library).

**Decision (confirmed with the developer):** tokenise on the **backend with
SudachiPy** (Python). The earlier note overlooked that Python has first-class
morphological analysers — so there is no need for a JS tokenizer or a Node
sidecar at all. SudachiPy keeps everything in Python, gives more accurate
dictionary-form lemmas (which drive JMdict lookups) and readings, and ships no
tokenizer dictionary to the browser. The frontend calls `/api/tokenize` once a
reply finishes streaming; furigana renders when it returns. This matches the
brief's §3 ("the backend owns … tokenization data") more closely than either
earlier plan.

### 2b. Kanji data: KANJIDIC2 instead of kanjium

**Brief said:** use `kanjium` for per-kanji readings/meanings.

**Decision:** use **KANJIDIC2** (the English `kanjidic2-en` JSON). KANJIDIC2 is
the canonical source for kanji *readings and meanings*; kanjium is primarily a
**pitch-accent** dataset. KANJIDIC2 also ships as clean JSON from the *same*
`jmdict-simplified` release as JMdict — one source, one format, one parsing path
in `build_dictionaries.py`. Flagged for review; kanjium (pitch accent) remains a
sensible future add for a pronunciation aid, which is a different feature.

### 2c. Dictionary served from a compiled SQLite file

JMdict + KANJIDIC2 are compiled once into `backend/data/dictionary.sqlite`
(~217k words, ~10k kanji) by `scripts/build_dictionaries.py`, queried read-only
per hover. The file is git-ignored and rebuilt via `npm run setup:dict`. If it
is missing, the dictionary service degrades gracefully (lookups return empty,
a startup warning is logged) — the app and furigana still work.

### 3. `SETTING_GROUPS` / `SettingGroup` removed

Originally exported from `config/settings.ts` for potential generic rendering. Removed before any consumer was written — each dropdown is explicit and fully type-safe. No impact.

### 4. Temperature default: 0.7

The brief did not specify temperature. 0.7 was chosen as a standard conversational default and confirmed to work well with `gemma3:27b`. Configurable via `KAIWA_TEMPERATURE`.

---

## Known issues, incomplete items, and deferred work

| Item | Status | Notes |
|------|--------|-------|
| **Mid-conversation register shift is gradual** | By design | The model honours the history's established register. On a fresh conversation the register difference is stark. Not a code issue. |
| **No "don't repeat topics" enforcement** | Partially addressed | The system prompt instructs the model to track topics, but this relies on model compliance — no structural enforcement. Acceptable for v1.0 per the brief. |
| **Context window limit** | Deferred (per brief §9) | Full history sent every turn. Very long sessions will eventually hit the model's context limit. Documented in README; summarisation is post-1.0. |
| **`checkHealth()` in `client.ts` is exported but unused** | Minor | Available for a future connection-status indicator in the UI. Not dead in the sense that it's part of the API client surface. |
| **eval_models.py combos are hardcoded** | Acceptable | The harness is a dev tool, not production code. Edit the `COMBOS` list to test different models or temperatures. |
| **Furigana okurigana alignment is heuristic** | Acceptable | Peels matching kana off both ends, then puts the reading over the kanji core. Handles the common cases (食べる, 美味しい); rare mixed-kana words may ruby a kana with the core. Falls back to whole-token ruby. |
| **Popover above/below flip is heuristic** | Minor | Flips above the token when near the viewport bottom (no live measurement). Fine for the chat layout; could be made measurement-based later. |
| **Reading aids only on assistant replies** | By design | User messages render plain (no furigana/lookup); per-message *feedback* on user input is Phase 3. |
| **JSON wire format is snake_case except `partOfSpeech`** | Resolved | FastAPI emits response models by alias; `WordSense.part_of_speech` carries a `serialization_alias` so it reaches the TS client as `partOfSpeech`. Watch this if adding more multi-word reading fields. |
| **`sudachidict-core` adds ~69 MB to the venv** | Acceptable | Bundled SudachiPy dictionary. One-time install cost; no runtime download. |

---

## What is NOT implemented (upcoming phases)

- **Phase 3:** Per-message collapsible feedback annotations (English, with corrected Japanese), soft labels, grammar-point save.
- **Phase 4:** Curated scenario mode (data-driven list), generated scenario mode.
- **Phase 5:** STT via faster-whisper, TTS via VOICEVOX (confirm engine first).
- **Post-1.0:** Anthropic provider, gamification, progress tracking, kanji-app integration, long-session compaction, mobile polish.

---

## Configuration reference

All backend settings read from `backend/.env` (or environment), prefixed `KAIWA_`. See `backend/.env.example` for the full list.

| Variable | Default | Purpose |
|----------|---------|---------|
| `KAIWA_LLM_PROVIDER` | `ollama` | Provider name (only `ollama` in v1.0) |
| `KAIWA_OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server |
| `KAIWA_OLLAMA_MODEL` | `gemma3:27b` | Model for all LLM calls |
| `KAIWA_TEMPERATURE` | `0.7` | Sampling temperature (conversation) |
| `KAIWA_TRANSLATION_TEMPERATURE` | `0.3` | Sampling temperature (translation pass) |
| `KAIWA_DICTIONARY_PATH` | `data/dictionary.sqlite` | Compiled dictionary (relative to backend root) |
| `KAIWA_CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |

Frontend: `VITE_API_BASE_URL` (default `http://localhost:8000`) in `frontend/.env.local`.
