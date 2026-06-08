# Project Brief — Japanese Conversation Practice App (working title: "Kaiwa")

> **For the implementing agent:** Read this entire document before writing any code. It describes the full product vision and a phased build plan. **Do not attempt to build everything at once.** Execute the phases in order, stopping at the end of each phase for review. Phase 0 and Phase 1 are the scope of the first session unless told otherwise.
>
> *"Kaiwa" (会話, "conversation") is a placeholder name — feel free to keep it or flag that it can be renamed later.*

---

## 1. What this is

A locally-run Japanese conversation practice app, inspired by **Pingo AI** but built to run entirely on the developer's own hardware (no subscription, no forced registration). The user holds a back-and-forth conversation in Japanese with an AI partner. The AI replies naturally, and provides on-the-fly correction/feedback on the user's Japanese without interrupting the conversational flow.

This serves two purposes simultaneously, and both matter:

1. **A genuinely useful personal tool** for the developer's own Japanese study.
2. **A presentable portfolio project** targeting software roles in the US and Japan. Code quality, architecture, and polish must meet a professional bar — this is something an employer will read. Treat every decision as if it will be code-reviewed by a senior engineer.

---

## 2. Core principles & developer preferences

These are non-negotiable and apply to every phase:

- **Local-first.** v1.0 runs fully locally against Ollama. No cloud dependency required to use the app.
- **Provider abstraction.** The LLM layer must be abstracted behind a clean interface so a second provider (Anthropic API) can be added later **without touching feature code**. v1.0 implements only the Ollama provider, but the seam must exist from day one.
- **Code quality is a first-class deliverable.** Modular, well-typed components. Proper separation of concerns. No hardcoded inline styles — use Tailwind utility classes and extract repeated patterns into components. Consistent formatting enforced by ESLint + Prettier. Meaningful names. Comments only where they add value.
- **Windows environment.** The developer is on Windows. All shell commands, scripts, and tooling instructions must be Windows-compatible (PowerShell / cmd), **not bash**. Use cross-platform npm scripts where possible.
- **Dark-themed, minimal UI.** Clean, uncluttered, dark by default. Prioritize legibility of Japanese text (good font, generous sizing, proper line height).
- **Honest technical assessment.** If something in this brief is a bad idea or there's a better approach, say so before implementing — don't silently comply, and don't silently override.

---

## 3. Tech stack

**Frontend**
- React + Vite + TypeScript
- Tailwind CSS
- Responsive design, **desktop-primary** but laid out so a mobile view is a later refinement rather than a rewrite. Use a mobile-friendly component structure now.
- Japanese typography: **Noto Sans JP** (consistent with the developer's other projects).

**Backend** (local server)
- **Python + FastAPI.** A backend is required because speech-to-text and text-to-speech run as Python/local services, and it keeps the (future) Anthropic API key server-side. FastAPI pairs well with the typed TS frontend and is a strong full-stack portfolio signal.
- The backend owns: the LLM provider abstraction, speech-to-text, text-to-speech, and serving dictionary/tokenization data as needed.

**LLM**
- **Ollama** (primary, v1.0). The developer runs Ollama locally on an RTX 5090 (32GB VRAM); `qwen3-coder:30b` is available but a chat-tuned model may be more appropriate for conversation — **recommend a suitable instruction/chat-tuned model and let the developer choose.** Model name should be configurable, not hardcoded.
- **Anthropic API** — provider implemented **post-1.0**, but the abstraction accommodates it now.

**Japanese language tooling**
- **kuromoji.js** (or an equivalent JS morphological analyzer) for deterministic tokenization and reading generation. This powers **both** furigana and the hover-lookup feature without spending an LLM call. (See §6 — furigana should be deterministic, not LLM-generated, because reliability matters and a tokenizer is more accurate and free.)
- **JMdict** (e.g. the `jmdict-simplified` JSON release) for word-level English definitions on hover.
- **kanjium** for per-kanji detail (readings, meanings) — the developer already has experience with this dataset.

**Speech (Phase 5)**
- STT: **faster-whisper** (the developer already runs this locally in Python).
- TTS: **VOICEVOX** is the recommended local Japanese TTS engine (free, local HTTP API, Japanese-native, natural voices). Verify current setup during implementation; Kokoro/Coqui are fallback options. Confirm the choice with the developer before building this phase.

---

## 4. Conversation model & settings

The conversation is the heart of the app. Three user-adjustable settings shape the AI's behavior, and **all three must be adjustable mid-conversation** (changing a setting affects subsequent turns, not retroactively).

### 4.1 Difficulty
How complex the AI's Japanese is (vocabulary, grammar, sentence length).
- **Beginner**
- **Intermediate**
- **Advanced**
- **Near-Fluent**

(Do **not** surface JLPT levels in the UI. Plain difficulty labels only.)

### 4.2 Formality / register
What speech register the AI uses. Four levels to capture the real spectrum of Japanese code-switching:
- **Casual** — close friends, family (友達言葉)
- **Friendly** — new friends, acquaintances, peers (warm but not stiff)
- **Polite** — strangers, service situations (丁寧語 / です・ます)
- **Formal** — workplace, business, seniors (敬語)

### 4.3 Conversation initiative
Who drives the conversation:
- **AI-led** — the AI actively steers, asks open questions, and proposes directions, making it easy for the user to respond (the helpful "...and then what happened?" behavior).
- **Balanced** — natural give-and-take.
- **User-led** — the AI responds to what the user says but lets them steer; minimal prompting.

All three settings translate to **system-prompt instructions**, not separate models or pipelines. They should be cleanly composed into the system prompt for each turn.

---

## 5. Conversation modes

Three ways to start/frame a conversation:

1. **Scenarios** — a curated list of pre-written situations (e.g. ordering at a restaurant, checking into a hotel, a job interview, small talk with a coworker). v1.0 ships a small hand-written set; the structure must make adding more trivial (data-driven, not hardcoded JSX).
2. **Generated** — the LLM generates a fresh scenario on the fly based on the current settings (and optionally a user-provided theme/topic).
3. **Free Talk** — open-ended conversation with no scenario framing. (Name chosen deliberately: フリートーク / "Free Talk" is a real loanword used in Japanese language-exchange contexts.)

---

## 6. The reply pipeline (per AI turn)

This is the trickiest part to get right. A single LLM call should **not** be asked to return Japanese + furigana + translation together — it's unreliable. Instead:

1. **LLM call → Japanese reply.** Generated from conversation history + composed system prompt (settings + mode). Display this immediately.
2. **Tokenization (kuromoji, deterministic, no LLM).** Tokenize the reply into words with readings. This output powers:
   - the **Furigana toggle** (render readings above kanji), and
   - the **hover-lookup** feature (see §7).
3. **LLM call → English translation.** Only fired if the **Translation toggle** is on. It's a transformation of an already-generated reply, so it's fast and cheap.

**Progressive disclosure:** the Japanese reply appears first; furigana renders as soon as tokenization completes; translation resolves slightly after if enabled. No blocking loading wall for the whole turn.

**Furigana and Translation are opt-in toggles**, off by default, so the default experience is clean Japanese and unnecessary work is skipped.

---

## 7. Reading aids & saving (in scope for v1.0)

- **Hover-lookup.** Because the reply is already tokenized (§6 step 2), each token is rendered in a way that supports hover. On hover:
  - word-level definition from **JMdict**, and/or
  - per-kanji detail from **kanjium**.
  - Pure frontend + local data; **no LLM call.**
- **Quick vocab save.** A one-click "save" on a word (kanji or not) stores it to `localStorage`. Keep the data model clean enough to later sync or export (think ahead to a possible future tie-in, but build only localStorage now).
- **Grammar-point save.** When a feedback annotation is tagged as grammar (§8), offer a "save" action that stores the correction text + the user's original sentence that triggered it. This is a personal log, **not** a grammar encyclopedia — keep it simple.

---

## 8. Feedback system (in scope for v1.0)

After the user sends a message, the AI replies **and** the user's message receives feedback — but the feedback must **not** interrupt the conversational flow.

- The AI responds in Japanese as normal (§6).
- The user's own message gets an **inline, collapsible annotation** (e.g. a small "💬 correction" affordance attached to their message). Collapsed by default so the conversation reads naturally; expandable on demand.
- If the user's Japanese is acceptable, the annotation simply confirms it's fine.
- If not, the feedback is **written in English**, explaining how the message should be phrased in Japanese instead (show the corrected Japanese).
- Feedback carries **soft labels** — `grammar`, `vocabulary`, `phrasing`, `naturalness` — used as helpful tags, **not** strict mutually-exclusive categories. A single correction may carry more than one label, and that's fine. Treat them as descriptive hints, not a rigid taxonomy.

Implementation note: the feedback is likely its own LLM call (the user's message + light context → structured-ish critique). Decide whether to run it in parallel with the reply call or sequentially, and explain the tradeoff. Keep the expected output simple and parseable.

---

## 9. Conversation memory

- Full conversation history is passed in context each turn (message array). **No vector DB / RAG for v1.0.**
- The system prompt instructs the AI to **track what's already been discussed and avoid repeating questions or topics** it has already raised.
- **Known limitation (acceptable for v1.0):** very long sessions will eventually approach the model's context limit. Document this; do not engineer a solution yet. A summarization/compaction strategy is a post-1.0 item.

---

## 10. Explicitly out of scope for v1.0 (but architecture must accommodate)

Do **not** build these now. Do build the app so adding them later doesn't require rearchitecting:

- **Anthropic API provider** — the provider abstraction must make this a clean add (new provider class/module, BYO-key handled server-side, hard spending caps when implemented).
- **Gamification** — daily goals, streaks, XP.
- **Progress tracking / analytics.**
- **Kanji-app integration** — feeding vocabulary between this app and the developer's separate kanji mnemonic app. (Keep the saved-vocab data model clean enough that this is feasible later.)
- **Long-session context compaction** (see §9).
- **Mobile-specific UI** — responsive structure now; dedicated mobile polish later.
- **In-between formality gradations** beyond the four levels in §4.2.

---

## 11. Phased build plan

Execute in order. Stop at the end of each phase for review.

### Phase 0 — Scaffold & architecture (first session)
- Set up the repo: `frontend/` (React + Vite + TS + Tailwind) and `backend/` (FastAPI). A monorepo-style layout is fine.
- ESLint + Prettier configured for the frontend; a formatter/linter for the Python backend (e.g. ruff/black). Windows-friendly npm scripts to run everything.
- Define the **LLM provider abstraction** (interface + an `OllamaProvider` implementation). A single round-trip "talk to Ollama" endpoint proves it works end to end.
- A `CLAUDE.md` (or equivalent project conventions doc) capturing the rules in §2 so future sessions stay consistent.
- Dark, minimal base layout with Noto Sans JP wired up.

### Phase 1 — Core conversation loop, text only (first session)
- Chat UI: user sends a text message, receives a Japanese reply.
- Conversation memory (history in context, §9), with the "don't repeat topics" instruction.
- The three settings (§4) wired into a cleanly-composed system prompt, **adjustable mid-conversation**.
- **Free Talk mode only** for this phase.
- No furigana / translation / feedback / voice yet — just a clean, working, settings-aware conversation.

### Phase 2 — Reading aids
- kuromoji tokenization of replies.
- Furigana toggle.
- Hover-lookup (JMdict words + kanjium kanji).
- Translation toggle (second LLM call, §6).
- Quick vocab save to localStorage.

### Phase 3 — Feedback system
- Per-message collapsible feedback annotations (§8), English feedback with corrected Japanese, soft labels.
- Grammar-point save.

### Phase 4 — Conversation modes
- Curated **Scenarios** (data-driven list).
- **Generated** scenario mode.

### Phase 5 — Voice
- STT input via faster-whisper (text *or* voice input — the user picks).
- TTS output via VOICEVOX (confirm engine choice first).

### Post-1.0 (not in this build)
- Anthropic provider, gamification, progress tracking, kanji-app integration, long-session compaction, mobile polish.

---

## 12. Definition of done for the first session

Phases 0 and 1 complete: a running app where the developer can type a message in Japanese, get a natural settings-aware reply from a local Ollama model, adjust difficulty/formality/initiative mid-conversation and see the behavior change, with the codebase cleanly structured (typed, linted, modular) and the provider abstraction in place. Everything runs on Windows with documented setup steps.

---

## 13. Before you start

If anything here is ambiguous, suboptimal, or you'd recommend a different approach (model choice, tokenizer, project layout, the parallel-vs-sequential feedback call, etc.), **raise it before building.** A short clarifying exchange now beats a rework later.
