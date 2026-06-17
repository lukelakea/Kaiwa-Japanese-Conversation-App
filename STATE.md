# STATE.md — Kaiwa project snapshot

**Last updated:** post-1.0 enhancement pass (conversation history, grammar
construction detection, TTS word-highlight, app settings panel, romaji,
rewind/regenerate, custom scenarios).  
**Current phase:** All phases of v1.0 (0–5) complete and hardened. All
post-1.0 refinements described below are committed — see the
**Post-1.0 enhancements** section for the full list.  
Read `PROJECT_BRIEF.md` for the full product vision and phase plan (it is the
frozen as-conceived brief; deviations and everything built since live here).

> **Heads-up for Phase 5:** restart the backend after pulling so the new
> `/api/stt` and `/api/tts` routes are registered, and run `npm run setup`
> once to pull the `faster-whisper` dependency into the uv environment.
> VOICEVOX must be running on `http://localhost:50021` before TTS is used.
> The faster-whisper model loads on first STT request (logged to the backend
> console); subsequent requests reuse the cached model.

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
│       │   ├── reading.py        Phase 2: Token/Furigana, Word/Kanji lookup, Translate models;
│       │   │                     post-1.0 adds GrammarMatch + Token conjugationForm/conjugationType
│       │   └── feedback.py       Phase 3: FeedbackLabel, FeedbackRequest/Response
│       ├── llm/
│       │   ├── base.py           LLMProvider ABC, LLMMessage, GenerationOptions (json_mode), LLMError
│       │   ├── ollama_provider.py  Streams /api/chat, error translation, timeout config
│       │   ├── factory.py        build_provider(settings) — only place that names providers
│       │   └── __init__.py       Re-exports the public surface
│       ├── japanese/             Phase 2+: deterministic JP tooling (no LLM)
│       │   ├── tokenizer.py      SudachiPy wrapper: tokens, lemmas, furigana alignment,
│       │   │                     conjugation form/type labels, fused-particle re-merge
│       │   ├── grammar.py        Post-1.0: rule-based multi-token construction detection
│       │   │                     (〜ている, 〜なきゃ, 〜ば〜ほど…) → GrammarMatch list
│       │   ├── dictionary.py     Read-only SQLite lookup (JMdict words + KANJIDIC2 kanji);
│       │   │                     priority-ranked, POS-aware, common-kana homophone suppression
│       │   ├── kana.py           katakana→hiragana helper shared across the JP modules
│       │   └── __init__.py       Re-exports Tokenizer, Dictionary
│       ├── prompts/
│       │   ├── system_prompt.py  compose_system_prompt(settings, mode, scenario?) — scenario
│       │   │                     framing injected for scenario/generated modes (Phase 4)
│       │   ├── translation_prompt.py  TRANSLATION_SYSTEM_PROMPT for the translate pass
│       │   ├── feedback_prompt.py  Phase 3: compose_feedback_prompt + format_feedback_input
│       │   └── scenario_prompt.py  Phase 4: GENERATE_SCENARIO_SYSTEM_PROMPT + input composer
│       └── api/
│           ├── chat.py           POST /api/chat — peek-first stream, 502 on startup errors
│           ├── reading.py        POST /api/tokenize (tokens + grammar matches), GET /api/lookup
│           ├── translate.py      POST /api/translate — second LLM call, JSON reply, 502 on error
│           ├── feedback.py       POST /api/feedback — parallel critique, json_mode, defensive parse
│           ├── scenario.py       POST /api/scenario/generate — Phase 4: LLM-generated scenario
│           ├── stt.py            Phase 5: POST /api/stt — multipart audio → faster-whisper transcript
│           └── tts.py            Phase 5: POST /api/tts (WAV + per-mora timings),
│                                 GET /api/tts/speakers (VOICEVOX speaker list)
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
│       │   ├── reading.ts        Phase 2: Token, FuriganaSegment, Word/Kanji entries, SavedWord;
│       │   │                     post-1.0 adds GrammarMatch, MoraTiming, conjugation fields
│       │   ├── feedback.ts       Phase 3: FeedbackLabel, Feedback, FeedbackStatus, SavedGrammar
│       │   ├── scenario.ts       Post-1.0: SavedScenario (user-designed scenario + settings preset)
│       │   ├── history.ts        Post-1.0: SavedConversation (archived conversation snapshot)
│       │   └── settings.ts       Post-1.0: AppSettings (text size, TTS voice/speed/autoplay, input
│       │                         translation) + DEFAULT_APP_SETTINGS + TEXT_SIZE_CLASS map
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
│       │   ├── useConversation.ts  Conversation state; send/startScenario plus post-1.0
│       │   │                       rewindToMessage, regenerateReply, restore, requestCorrectionTranslation
│       │   ├── useSavedVocab.ts    localStorage-backed saved words (has/save/remove)
│       │   ├── useSavedGrammar.ts  localStorage-backed saved grammar points (has/save/remove)
│       │   ├── useSavedConversations.ts  Post-1.0: localStorage conversation archive (upsert by id, cap 50)
│       │   ├── useSavedScenarios.ts      Post-1.0: localStorage user-designed scenarios (upsert by id)
│       │   ├── useAppSettings.ts   Post-1.0: localStorage AppSettings (text size, TTS, input translation)
│       │   ├── useAudioRecorder.ts Phase 5: mic recording + STT lifecycle
│       │   ├── useHealth.ts        Hardening: polls /api/health for the header status dot
│       │   ├── useTokenLookup.ts   Cached per-token dictionary fetch (process-wide Map)
│       │   └── useClickOutside.ts  Pointer-down + Escape handler for dropdowns
│       └── components/
│           ├── chat/
│           │   ├── ModeSelector.tsx    Mode-selection flow (picker → scenario list/detail, generated
│           │   │                       setup/preview, or post-1.0 custom-scenario designer + saved list)
│           │   ├── MessageBubble.tsx   Bubbles; TokenizedText + translation + feedback + TTS playback
│           │   │                       with word-highlight; post-1.0 rewind/regenerate controls
│           │   ├── FeedbackAnnotation.tsx  Phase 3: collapsible critique + grammar save + correction translate
│           │   ├── MessageList.tsx     Scrolls to bottom; forwards furigana/romaji/translation/feedback props
│           │   ├── TranslationText.tsx Post-1.0: renders a translation line with loading/error/retry
│           │   ├── EmptyState.tsx      "会話を始めましょう" prompt (shown during Free Talk before first message)
│           │   └── MessageInput.tsx    Auto-grow textarea, IME-safe Enter, send/stop, mic; input-translation preview
│           ├── reading/
│           │   ├── TokenizedText.tsx   Renders tokens + furigana/romaji; hover popover; grammar/inflection chains
│           │   ├── WordPopover.tsx     Portal card: words + kanji + grammar construction, with save button
│           │   ├── ReadingControls.tsx Furigana/Romaji/Translate toggles
│           │   ├── SavedPanel.tsx      Slide-over with Words / Grammar tabs
│           │   ├── inflectionChains.ts Post-1.0: groups a content word + auxiliary tail into one hover unit
│           │   └── alignTiming.ts      Post-1.0: maps VOICEVOX mora timings → per-token spans for TTS highlight
│           ├── settings/
│           │   ├── SettingDropdown.tsx  Generic dropdown, generic over value type T
│           │   ├── SettingsBar.tsx      Three conversation-setting dropdowns composed
│           │   └── AppSettingsPanel.tsx Post-1.0: slide-over for AppSettings (text size, TTS, input translation)
│           ├── history/
│           │   └── ConversationHistory.tsx  Post-1.0: slide-over archive list (restore / delete)
│           ├── layout/
│           │   └── Header.tsx          Title, status dot, New-conversation, Settings/History/Saved, auto-play toggle
│           └── ui/
│               ├── icons.tsx     Inline SVG icon set (chat, reading aids, voice, history, settings…)
│               ├── ToggleButton.tsx  Pill toggle used by the reading-aid switches
│               ├── Tooltip.tsx   Post-1.0: lightweight hover/focus tooltip used across the controls
│               └── ErrorBanner.tsx  role="alert" strip above the input
│
└── backend/scripts/
    ├── eval_models.py    A/B harness: given model+temp combos, runs a 3-turn JP conversation
    │                     and flags any non-Japanese character leakage. Standalone (sets sys.path,
    │                     reconfigures stdout to UTF-8). Run: uv run python scripts/eval_models.py
    ├── build_dictionaries.py  Downloads JMdict + KANJIDIC2 (jmdict-simplified release) and
    │                     compiles backend/data/dictionary.sqlite (with priority scores). Idempotent.
    ├── eval_difficulty.py  Post-1.0 dev check: runs the real composed prompt once per Difficulty
    │                     level and prints rough complexity signals so the four levels can be compared.
    └── find_fused_particles.py  Post-1.0 dev tool: lists short kana-only JMdict grammatical words
                          that Sudachi splits, as candidates for the tokenizer's _FUSED_PARTICLES allowlist.
```

> **Tests** (`backend/tests/`): system-prompt composition, tokeniser round-trip +
> furigana alignment, feedback/scenario JSON parsing, plus post-1.0 additions —
> `test_grammar.py` (construction detection), `test_dictionary.py` +
> `test_lookup_integration.py` (ranking/homophone suppression), `test_tts.py`
> (mora-timing extraction). None need Ollama, VOICEVOX, or the dictionary file.

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
- All three are adjustable mid-conversation in the UI. Each turn's settings are sent in the request; the next reply reflects the new settings. (A setting change partway through a long conversation shifts tone gradually rather than abruptly, which is realistic model behavior — not a bug.)
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
  answer, so there is nothing to serialize. The user's message receives an
  **inline, collapsible annotation**, collapsed by default so the conversation
  reads naturally.
- **Acceptable vs. correction.** When the message is already natural the
  affordance is a muted green "Looks good"; otherwise an amber "Suggestion" with
  **soft labels** (`grammar` / `vocabulary` / `phrasing` / `naturalness`, often
  more than one). Expanding shows the **English explanation** and the **corrected
  Japanese** (brief §8).
- **Register-aware.** The request carries the current settings; the prompt judges
  against the register the learner is *practicing*, so casual input is not
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
morphological analyzers — so there is no need for a JS tokenizer or a Node
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
assistant's answer, so serializing would only add the reply's latency to the
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
| **Mid-conversation register shift is gradual** | By design | The model honors the history's established register. On a fresh conversation the register difference is stark. Not a code issue. |
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
  appears as a small accent-colored pill in the header, giving context without clutter.
- **Settings bar hidden on mode picker.** The settings/reading controls only appear once a
  conversation is active. The mode picker uses full-screen layout, uncluttered.

---

### Phase 5 — Voice ✓

All deliverables built, linted clean, and verified in the browser (frontend snapshot):

- **STT input via faster-whisper (brief §11).** A mic button in the message input
  (left of the textarea) lets the user record voice. Clicking it starts capturing
  from the default microphone; clicking again stops and sends the audio to
  `POST /api/stt`. The backend saves the upload to a temp file, runs faster-whisper
  with `language="ja"`, and returns the transcript. The transcript populates the
  textarea so the user can review/edit before sending. The textarea is disabled
  during recording and processing with a Japanese-language placeholder
  (録音中…/文字起こし中…). Microphone permission errors surface inline. The
  faster-whisper model loads lazily on first use and is cached for the process
  lifetime; a startup log line announces when it is ready.
- **TTS output via VOICEVOX (brief §11).** A small speaker icon appears below
  every completed assistant reply. Clicking it calls `POST /api/tts`, which calls
  VOICEVOX's two-step API (`/audio_query` then `/synthesis`) and returns raw WAV.
  The frontend plays the WAV via `new Audio(blobURL)`. While loading: a small
  CSS spinner. While playing: a stop icon (clicking stops playback). Blob URLs are
  revoked on playback end to avoid leaks. The button is absent while the AI reply
  is still streaming; it appears only on complete messages.
- **Both input modes simultaneously.** Text typing and voice input co-exist:
  the mic toggles between idle/recording/processing; typing is unaffected while
  the mic is idle and is disabled only during active recording/processing.
- **Graceful degradation.** If VOICEVOX is not running, the TTS button silently
  fails (no UI crash). If the whisper model fails to load, the endpoint returns
  a 503 with a human-readable message.

New backend files:
- `backend/app/api/stt.py` — `POST /api/stt` (multipart audio → transcript JSON)
- `backend/app/api/tts.py` — `POST /api/tts` (JSON text → WAV bytes)

New frontend files:
- `frontend/src/hooks/useAudioRecorder.ts` — mic recording + STT lifecycle hook

New/modified:
- `backend/app/config.py` — 5 new KAIWA_VOICEVOX_* and KAIWA_WHISPER_* settings
- `backend/pyproject.toml` — `faster-whisper>=1.1` dependency added
- `backend/.env.example` — voice config vars documented
- `frontend/src/api/client.ts` — `transcribe()` and `synthesize()` added
- `frontend/src/components/ui/icons.tsx` — MicIcon, MicOffIcon, SpeakerIcon, SpeakerOffIcon
- `frontend/src/components/chat/MessageInput.tsx` — mic button + recorder integration
- `frontend/src/components/chat/MessageBubble.tsx` — TtsButton on assistant replies

---

### 1.0 hardening (post-Phase 5 polish)

Portfolio/quality pass over the finished v1.0 — no new product features:

- **Test suites + CI.** `backend/tests/` (pytest) covers system-prompt
  composition across the full settings matrix, the furigana alignment heuristic
  + tokeniser round-trip, and the defensive feedback/scenario JSON parsing.
  `frontend/src/**/*.test.ts` (Vitest) covers the typed API client (mocked
  `fetch`) and `useConversation` (mocked client) — including the brief §8
  parallel feedback/reply dispatch and §9 full-history send. Run with
  `npm test` (or `test:frontend` / `test:backend`). A GitHub Actions workflow
  (`.github/workflows/ci.yml`) runs lint + format-check + tests + build for both
  halves on push/PR. None of the tests need Ollama, VOICEVOX, or the dictionary.
- **Connection indicator.** The previously-unused `checkHealth()` now backs a
  `useHealth` hook and a small status dot in the header (green/red/checking),
  polling `/api/health` every 15s so the user sees if the backend is down before
  they type.
- **LICENSE** (MIT) and a **README hero screenshot** (`docs/screenshot.png`,
  a real capture: furigana on, feedback chip, connection dot). README status
  updated from the stale "Phases 0–2" to v1.0-complete with the full feature set.
- **Mobile sanity-checked** at 375px (brief's "responsive structure now"): the
  settings bar and reading controls wrap into rows, bubbles reflow, no overflow.
- `app/api/tts.py` reformatted by `ruff format` (now enforced in CI).

---

## Post-1.0 enhancements (on top of the finished v1.0)

Refinements layered onto the completed app — no rearchitecting, all consistent
with the brief's principles. (Some committed, some still in the working tree.)

- **Grammar construction detection (reading aids).** `backend/app/japanese/grammar.py`
  scans the token stream for ~30 curated multi-token constructions (〜ている,
  〜てしまう/ちゃう, 〜なきゃ/なくちゃ, 〜ば〜ほど, 〜かもしれない, 〜ことができる…)
  using a declarative `Pattern` library of per-token matchers with optional tails
  and bounded gaps for split patterns. Deterministic, rule-based (no LLM, brief §6).
  `/api/tokenize` now returns `grammar: GrammarMatch[]` alongside tokens; the hover
  popover explains the whole construction next to the parts, whichever member token
  is hovered. Frontend `inflectionChains.ts` does the lighter complementary job of
  grouping a content word + its auxiliary tail (あり+まし+た) into one hover unit.
- **Richer token metadata.** The tokenizer now emits `conjugationForm` and
  `conjugationType` labels, and re-merges a curated `_FUSED_PARTICLES` allowlist so
  Sudachi-split grammatical words (かも, よね, とか…) resolve to their proper JMdict
  entry instead of a wall of single-kana homophones. `find_fused_particles.py`
  generates review candidates for that allowlist.
- **Better hover-dictionary ranking.** `dictionary.py` orders results by JMdict
  priority and POS match, and suppresses kanji homophones only when a *common*
  kana-written word shares the reading (so 鴇/とき doesn't bury 時). Covered by
  `test_dictionary.py` and `test_lookup_integration.py`.
- **Conversation history / archive.** Completed exchanges auto-save to localStorage
  (`useSavedConversations`, upsert-by-id, capped at 50). A header History button opens
  `ConversationHistory`, a slide-over to restore (full message state, settings, mode,
  scenario) or delete past conversations. Restored messages are flagged `fromHistory`.
- **Rewind & regenerate.** `useConversation` gains `rewindToMessage` (drop a user
  message + everything after, returning its text to the input for editing) and
  `regenerateReply` (re-stream an assistant turn from the preceding history).
- **Custom scenarios.** Beyond curated + generated, users can design and save their
  own scenarios with a settings preset (`SavedScenario`, `useSavedScenarios`); the
  `ModeSelector` gained a designer and a saved-scenario list. Backend `Scenario` gained
  optional `notes`/`goal` fields.
- **App settings panel.** `AppSettingsPanel` + `useAppSettings` (localStorage) expose
  text size (sm/md/lg/xl), TTS voice/speed/auto-play, and an input-translation preview.
- **Romaji toggle.** A third reading-aid toggle alongside Furigana/Translate, rendering
  romaji from the deterministic token readings.
- **TTS word-highlight.** `/api/tts` now returns per-mora timings (extracted from the
  VOICEVOX `audio_query`); `alignTiming.ts` maps them onto token spans so the spoken
  word is highlighted in sync during playback. Playback speed and auto-play come from
  AppSettings; `GET /api/tts/speakers` backs the voice picker.
- **Input-translation preview & correction translation.** The composer can show a live
  English preview of the message being typed; feedback corrections can be translated
  on demand (`requestCorrectionTranslation`) — both reuse the existing `/api/translate`.

## Post-1.0: Anthropic provider (cloud, opt-in)

The provider abstraction's promised second backend, added behind the existing
seam (brief §2, §10). Local-first is unchanged: Ollama stays the default and the
`anthropic` dependency is an **optional extra** (`uv sync --extra anthropic`),
imported lazily by the factory only when selected.

- `backend/app/llm/anthropic_provider.py` implements `LLMProvider` over the
  Anthropic Messages API (streaming). It reconciles two shape differences behind
  the interface: it **hoists the `role="system"` message into the top-level
  `system` parameter**, and it **never forwards `temperature`** (current Claude
  models reject sampling params — register/variety is steered by the system
  prompt). A scenario-opening request (empty turns) gets a minimal injected user
  nudge so the API has something to answer. SDK errors map to `LLMError` → 502.
- `factory.py` gained one branch (lazy import + key check); it is still the only
  file naming a concrete provider. **No feature code changed** beyond swapping
  `settings.ollama_model` → `settings.active_model` (a provider-neutral resolver)
  in the four LLM endpoints.
- Config: `KAIWA_ANTHROPIC_API_KEY` (server-side, never sent to the client) and
  `KAIWA_ANTHROPIC_MODEL` (default `claude-sonnet-4-6`). Switch with
  `KAIWA_LLM_PROVIDER=anthropic`. `/api/health` reports `active_model`.
- Tests: `test_anthropic_provider.py` (system hoisting, temperature omission,
  delta streaming, error translation — SDK faked, runs offline) and
  `test_factory.py`. CI's backend job syncs `--extra anthropic` so the provider
  is linted and tested; end-user installs omit it.
- **Deferred (brief §10):** hard spending caps for the cloud provider — flagged
  with a TODO in the factory.

## What is NOT implemented (post-1.0)

- **Post-1.0:** gamification, progress tracking, kanji-app integration, long-session compaction, mobile polish.

---

## Configuration reference

All backend settings read from `backend/.env` (or environment), prefixed `KAIWA_`. See `backend/.env.example` for the full list.

| Variable | Default | Purpose |
|----------|---------|---------|
| `KAIWA_LLM_PROVIDER` | `ollama` | Provider name: `ollama` (local) or `anthropic` (cloud, opt-in) |
| `KAIWA_OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server |
| `KAIWA_OLLAMA_MODEL` | `gemma3:27b` | Ollama model for all LLM calls |
| `KAIWA_ANTHROPIC_API_KEY` | _(none)_ | Anthropic key (server-side); required when provider is `anthropic` |
| `KAIWA_ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Anthropic model when provider is `anthropic` |
| `KAIWA_TEMPERATURE` | `0.7` | Sampling temperature (conversation) |
| `KAIWA_TRANSLATION_TEMPERATURE` | `0.3` | Sampling temperature (translation pass) |
| `KAIWA_FEEDBACK_TEMPERATURE` | `0.3` | Sampling temperature (feedback pass — cool for stable JSON) |
| `KAIWA_DICTIONARY_PATH` | `data/dictionary.sqlite` | Compiled dictionary (relative to backend root) |
| `KAIWA_CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `KAIWA_VOICEVOX_BASE_URL` | `http://localhost:50021` | VOICEVOX local HTTP API (Phase 5) |
| `KAIWA_VOICEVOX_SPEAKER` | `2` | Default VOICEVOX speaker/style ID (overridable per-request from the app's TTS voice picker) |
| `KAIWA_WHISPER_MODEL` | `base` | faster-whisper model size (tiny/base/small/medium/large-v3) |
| `KAIWA_WHISPER_DEVICE` | `cuda` | faster-whisper device (`cuda` or `cpu`) |
| `KAIWA_WHISPER_COMPUTE_TYPE` | `float16` | CTranslate2 compute type (`float16` for GPU, `int8` for CPU) |

Frontend: `VITE_API_BASE_URL` (default `http://localhost:8000`) in `frontend/.env.local`.
