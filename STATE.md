# STATE.md — Kaiwa project snapshot

**Last updated:** end of session 4 (Phase 4).  
**Current phase:** Phase 4 complete. Next phase: Phase 5 (Voice — STT + TTS).  
Read `PROJECT_BRIEF.md` for the full product vision and phase plan.

> **Heads-up:** if a backend was already running from a previous phase, restart
> it (`npm run dev` / `npm run dev:backend`) so the new `/api/scenario/generate`
> route is registered. A fresh start picks it up automatically.

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
│       │   ├── conversation.py   Domain enums + Pydantic models; Phase 4 adds Scenario,
│       │   │                     GenerateScenarioRequest/Response; ChatRequest gains scenario field
│       │   ├── reading.py        Phase 2: Token/Furigana, Word/Kanji lookup, Translate models
│       │   └── feedback.py       Phase 3: FeedbackLabel, FeedbackRequest/Response
│       ├── llm/
│       │   ├── base.py           LLMProvider ABC, LLMMessage, GenerationOptions (json_mode), LLMError
│       │   ├── ollama_provider.py  Streams /api/chat, error translation, timeout config
│       │   ├── factory.py        build_provider(settings) — only place that names providers
│       │   └── __init__.py       Re-exports the public surface
│       ├── japanese/             Phase 2: deterministic JP tooling (no LLM)
│       │   ├── tokenizer.py      SudachiPy wrapper: tokens, lemmas, furigana alignment
│       │   ├── dictionary.py     Read-only SQLite lookup (JMdict words + KANJIDIC2 kanji)
│       │   └── __init__.py       Re-exports Tokenizer, Dictionary
│       ├── prompts/
│       │   ├── system_prompt.py  compose_system_prompt(settings, mode, scenario?) — scenario
│       │   │                     framing injected for scenario/generated modes (Phase 4)
│       │   ├── translation_prompt.py  TRANSLATION_SYSTEM_PROMPT for the translate pass
│       │   ├── feedback_prompt.py  Phase 3: compose_feedback_prompt + format_feedback_input
│       │   └── scenario_prompt.py  Phase 4: GENERATE_SCENARIO_SYSTEM_PROMPT + input composer
│       └── api/
│           ├── chat.py           POST /api/chat — peek-first stream, 502 on startup errors
│           ├── reading.py        POST /api/tokenize, GET /api/lookup (threadpool-dispatched)
│           ├── translate.py      POST /api/translate — second LLM call, JSON reply, 502 on error
│           ├── feedback.py       POST /api/feedback — parallel critique, json_mode, defensive parse
│           └── scenario.py       POST /api/scenario/generate — Phase 4: LLM-generated scenario
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
│       ├── App.tsx           Top-level layout; Phase 4 adds activeMode/activeScenario state,
│       │                     ModeSelector shown when no mode active, conversation UI when active
│       ├── types/
│       │   ├── conversation.ts   TS types mirroring backend models; Phase 4 adds Scenario,
│       │   │                     ChatRequest gains optional scenario field
│       │   ├── reading.ts        Phase 2: Token, FuriganaSegment, Word/Kanji entries, SavedWord
│       │   └── feedback.ts       Phase 3: FeedbackLabel, Feedback, FeedbackStatus, SavedGrammar
│       ├── config/
│       │   ├── settings.ts   Option metadata arrays + DEFAULT_SETTINGS (data-driven)
│       │   └── scenarios.ts  Phase 4: CURATED_SCENARIOS (10 scenarios), CuratedScenario type,
│       │                     toWireScenario() converter
│       ├── context/
│       │   ├── SavedVocabContext.tsx    Shares the saved-vocab store (used deep in the popover)
│       │   └── SavedGrammarContext.tsx  Shares the saved-grammar store (feedback annotation → panel)
│       ├── api/
│       │   └── client.ts     streamChat(), tokenize(), lookup(), translate(), requestFeedback(),
│       │                     generateScenario(), checkHealth()
│       ├── hooks/
│       │   ├── useConversation.ts  Phase 4: send() gains mode+scenario params; adds startScenario()
│       │   │                       for AI-first scenario opening (messages:[])
│       │   ├── useSavedVocab.ts    localStorage-backed saved words (has/save/remove)
│       │   ├── useSavedGrammar.ts  localStorage-backed saved grammar points (has/save/remove)
│       │   ├── useTokenLookup.ts   Cached per-token dictionary fetch (process-wide Map)
│       │   └── useClickOutside.ts  Pointer-down + Escape handler for dropdowns
│       └── components/
│           ├── chat/
│           │   ├── ModeSelector.tsx    Phase 4: full mode-selection flow (mode picker → scenario
│           │   │                       list/detail or generated setup/preview → start)
│           │   ├── MessageBubble.tsx   Bubbles; renders TokenizedText + translation + feedback
│           │   ├── FeedbackAnnotation.tsx  Phase 3: collapsible per-message critique + grammar save
│           │   ├── MessageList.tsx     Scrolls to bottom; forwards furigana/translation/feedback props
│           │   ├── EmptyState.tsx      "会話を始めましょう" prompt (shown during Free Talk before first message)
│           │   └── MessageInput.tsx    Auto-grow textarea, IME-safe Enter, send/stop button
│           ├── reading/
│           │   ├── TokenizedText.tsx   Renders tokens + furigana; orchestrates the hover popover
│           │   ├── WordPopover.tsx     Portal dictionary card (words + kanji) with save button
│           │   ├── ReadingControls.tsx Furigana/Translate toggles + Saved button (words + grammar count)
│           │   └── SavedPanel.tsx      Slide-over with Words / Grammar tabs (replaces SavedVocabPanel)
│           ├── settings/
│           │   ├── SettingDropdown.tsx  Generic dropdown, generic over value type T
│           │   └── SettingsBar.tsx      Three dropdowns composed; onChange spreads new value
│           ├── layout/
│           │   └── Header.tsx          Title + "New conversation" button (disabled if empty)
│           └── ui/
│               ├── icons.tsx     Chevron/Send/Stop + Bookmark/Close/Chat/Check/ChevronRight (inline SVG)
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

### Phase 3 — Feedback system ✓

All deliverables built and verified end-to-end in the browser against a live
`gemma3:27b`:

- **Per-message feedback (brief §8).** `POST /api/feedback` critiques the user's
  most recent message. It runs as a **separate LLM call fired in parallel with
  the chat reply** (verified: both POSTs leave together) — the critique depends
  only on the user's text and the turn it replies to, never on the assistant's
  answer, so there is nothing to serialise. The user's message receives an
  **inline, collapsible annotation**, collapsed by default so the conversation
  reads naturally.
- **Acceptable vs. correction.** When the message is already natural the
  affordance is a muted green "Looks good"; otherwise an amber "Suggestion" with
  **soft labels** (`grammar` / `vocabulary` / `phrasing` / `naturalness`, often
  more than one). Expanding shows the **English explanation** and the **corrected
  Japanese** (brief §8).
- **Register-aware.** The request carries the current settings; the prompt judges
  against the register the learner is *practising*, so casual input is not
  "corrected" up to です・ます (verified).
- **Structured output.** `GenerationOptions.json_mode` maps to Ollama's
  `format: "json"`; the endpoint validates defensively (brace extraction, label
  filtering, correction cleared when acceptable) into `FeedbackResponse`, and
  returns a clean 502 on an unreachable model or unparseable output.
- **Grammar-point save (brief §7).** When a correction is labelled `grammar`, the
  expanded annotation offers "Save grammar point" → `localStorage`
  (original sentence + correction + explanation). Stored via `useSavedGrammar` /
  `SavedGrammarContext`, surfaced in the **Saved** slide-over's new **Grammar**
  tab (the panel is now tabbed: Words / Grammar). The "Saved" button counts both.

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

### 5. Feedback runs in parallel with the reply (brief §8 asked us to decide)

**Brief said:** "Decide whether to run [feedback] in parallel with the reply
call or sequentially, and explain the tradeoff."

**Decision: parallel.** `useConversation.send` fires `/api/feedback` and the chat
stream at the same time (verified in the browser network panel — both POSTs
leave together). The critique's inputs are fully known the instant the user hits
send (their message + the turn it replies to); it has **no dependency** on the
assistant's answer, so serialising would only add the reply's latency to the
feedback with zero benefit. The two results land independently: the reply streams
into its bubble, the annotation resolves under the user's message. The only cost
is two concurrent model calls on the same Ollama instance; on the target RTX 5090
that is a non-issue, and the abstraction would let a future provider fan these out
trivially.

### 7. Scenario opening: AI goes first via empty messages list

**Brief said:** scenarios are framed conversations; didn't specify who opens.

**Decision:** for both `scenario` and `generated` modes, the AI opens the conversation.
`ChatRequest.messages` now accepts an empty list (removed `min_length=1`). The frontend
calls `/api/chat` with `messages: []` to trigger the opening; the system prompt's scenario
section includes "if no prior messages, begin by greeting and setting the scene." The
alternative (user types first) was considered but rejected: for role-play contexts like
a hotel check-in or job interview, the AI character (receptionist, interviewer) naturally
speaks first, and starting cold forces the user into an awkward opener.

### 6. Structured feedback via `json_mode`, not prompt-and-hope

`GenerationOptions` gained a provider-neutral `json_mode` flag; `OllamaProvider`
maps it to `format: "json"`, which constrains the model to a single valid JSON
object. This is far more reliable than asking a local model to format itself. The
endpoint still validates defensively (brace extraction, label filtering against
the enum, `correction` cleared when `acceptable`) and returns a clean 502 on an
unreachable model or unparseable output, so the client always gets a typed result
or a retryable error. The flag is generic — a future Anthropic provider maps it
to its own structured-output mode with no feature-code change.

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
| **Reading aids only on assistant replies** | By design | User messages render plain (no furigana/lookup). Feedback (Phase 3) is the per-message critique on user input. |
| **Feedback quality depends on the model** | Acceptable | Correctness/labels are only as good as `gemma3:27b`. The contract (JSON shape, register-awareness) is enforced; the judgement is not. A retry is offered on failure. |
| **Feedback fires on every user message** | By design (brief §8) | Including trivial ones (e.g. "はい"). The model returns "Looks good" quickly; not gated to avoid a call, since the user expects feedback on each turn. |
| **Feedback is not re-run when settings change** | Minor | A message is critiqued once against the register active when sent. Changing register later does not re-grade past messages; a manual retry uses the then-current settings. Matches the "settings affect the next turn" model (brief §4). |
| **Scenario framing persists if settings change mid-conversation** | By design | The scenario (title, description, roles) is passed on every turn; only the difficulty/formality/initiative shift. Changing register mid-scenario adjusts the AI's language level but keeps the role framing intact. Consistent with the "settings affect the next turn" contract. |
| **Generated scenario quality depends on the model** | Acceptable | `gemma3:27b` reliably produces valid JSON and sensible scenarios. A weak local model may occasionally return malformed JSON (caught defensively, returns 502 + retry). The `title_ja` field occasionally uses non-standard phrasing — acceptable for v1.0. |
| **JSON wire format is snake_case except `partOfSpeech`** | Resolved | FastAPI emits response models by alias; `WordSense.part_of_speech` carries a `serialization_alias` so it reaches the TS client as `partOfSpeech`. Watch this if adding more multi-word reading fields. |
| **`sudachidict-core` adds ~69 MB to the venv** | Acceptable | Bundled SudachiPy dictionary. One-time install cost; no runtime download. |

---

### Phase 4 — Conversation modes ✓

All deliverables built and verified in the browser:

- **Mode selector (brief §5).** Replaces the blank empty state. Before a conversation starts,
  the user chooses from three modes via a full-screen picker. The settings bar and message
  input are hidden until a mode is active; "New conversation" resets to the picker.
- **Curated Scenarios.** Ten hand-written scenarios across five categories (daily-life, work,
  social, travel, services): restaurant, hotel check-in, job interview, coworker small talk,
  convenience store, directions, party meeting, doctor visit, izakaya, clothes shopping.
  Data-driven in `config/scenarios.ts` — adding a new scenario is one object. The picker
  shows Japanese titles + English hints in a two-column grid; clicking opens a detail card
  (description, both roles, Start button).
- **Generated mode.** `POST /api/scenario/generate` takes an optional theme + current
  settings and returns a JSON scenario via the same `json_mode` pattern as feedback.
  The frontend shows a theme input, displays the generated scenario for review, and the
  user confirms before starting. Defensive parsing (brace extraction, ValidationError
  handling) matches the feedback endpoint.
- **AI-first scenario opening.** Both scenario modes trigger `startScenario()` in
  `useConversation`, which calls `/api/chat` with `messages: []`. The system prompt's
  scenario section instructs the AI to open the scene if no prior messages exist, so it
  greets and sets the scene naturally in character. Subsequent turns call `/api/chat` with
  `mode` and `scenario` forwarded in every request so the framing persists throughout.
- **Scenario badge in header.** When a scenario is active, the scenario's Japanese title
  appears as a small accent-coloured pill in the header, giving context without clutter.
- **Settings bar hidden on mode picker.** The settings/reading controls only appear once a
  conversation is active. The mode picker uses full-screen layout, uncluttered.

---

## What is NOT implemented (upcoming phases)

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
| `KAIWA_FEEDBACK_TEMPERATURE` | `0.3` | Sampling temperature (feedback pass — cool for stable JSON) |
| `KAIWA_DICTIONARY_PATH` | `data/dictionary.sqlite` | Compiled dictionary (relative to backend root) |
| `KAIWA_CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |

Frontend: `VITE_API_BASE_URL` (default `http://localhost:8000`) in `frontend/.env.local`.
