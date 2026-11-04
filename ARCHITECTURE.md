# Architecture

This document describes the structure of the Anki flashcard generator after the provider-abstraction refactor.

---

## High-level data flow

```
docs/ (text files)
       │
       ▼
 txt-processor.ts
  parseTxtFile / parseAllDocuments
  ┌──────────────────────────────────┐
  │ ParsedDocument                   │
  │  meta: { thinker, work, chapter, │
  │          domain }                │
  │  paragraphsWithExtra: [          │
  │    { text, extraCards, subDeck } │
  │  ]                               │
  └──────────────────────────────────┘
       │  flattenParagraphs()
       ▼
 ParagraphWithMeta[]
       │
       ▼
 getProvider(config)          ← src/providers/index.ts (factory)
       │
       ├─ CARD_PROVIDER=gemini  → GeminiCardProvider (Gemini SDK, per-thinker chat sessions)
       ├─ CARD_PROVIDER=claude  → ClaudeCardProvider (headless `claude` CLI)
       └─ CARD_PROVIDER=mock   → MockCardProvider   (offline, deterministic)
       │
       ▼
 provider.generateFlashcards(paragraph, meta, opts)
  → GeneratedFlashcard[]
       │
       ▼
 applyMetaTags(cards, meta)   ← tags: type + thinker + work + chapter, spaces→_
       │
       ▼
 flashcardToNote(card, meta, parentDeck, ...)
       │
       ├─ DRY_RUN=true  → skip (log only)
       └─ DRY_RUN=false → addNote() via AnkiConnect HTTP
```

---

## Provider abstraction

The `CardProvider` interface lives in `src/providers/types.ts`:

```ts
interface CardProvider {
  readonly name: string;
  generateFlashcards(
    paragraph: string,
    meta: DocumentMeta,
    opts?: GenerateOptions
  ): Promise<GeneratedFlashcard[]>;
}
```

The factory `getProvider(config: AppConfig): CardProvider` in `src/providers/index.ts` is the only seam the scripts import. Scripts never reference a concrete provider class directly.

Tag normalization (`applyMetaTags`) is applied centrally after generation so all providers produce identically-tagged output.

---

## The three providers

### gemini (default)

- Uses `@google/generative-ai` SDK directly — no external proxy process needed.
- Maintains stateful per-`thinker|work` chat sessions so Gemini has document context.
- Supports Hebrew and English prompts.
- Standard mode: 1–3 cards per paragraph.
- Deep mode (`extraCards: true`, triggered by `---+` in the source file): 3–6+ cards with broader coverage.
- Requires `GOOGLE_API_KEY` (or `GEMINI_API_KEY`). Model defaults to `gemini-2.5-pro`.

### claude

- Calls the headless `claude` CLI (`claude -p`), which uses your Claude subscription.
- No API key required — uses the subscription tied to the local `claude` installation.
- Per-paragraph generation; each invocation is a fresh subprocess.
- Configurable via `CLAUDE_BIN`, `CLAUDE_MODEL`, `CLAUDE_TIMEOUT_MS`.

### mock

- Fully offline and deterministic.
- Standard mode: 1 `Concept` card derived from the paragraph snippet.
- Deep mode: 2 cards (`Concept` + `Argument`).
- Used by the test suite and for dry-runs to exercise the full pipeline without any credentials.

---

## Two generation paths

### 1. CLI path (baked-in SDK / subprocess)

Scripts `scripts/process.ts` and `scripts/retry-paragraphs.ts` drive this path.

- Reads files from `DOCS_DIR`.
- Calls `getProvider(config)` to pick a provider at startup.
- Processes paragraphs one at a time; caches raw JSON in `.cache/` before writing to Anki.
- `--provider <name>` and `--dry-run` flags let you override config at call time.

### 2. Claude Code skill path (`.claude/skills/generate-cards/`)

This is the "Claude subscription + CandleKeep" path, designed for deep, broad-scope coverage that is difficult to achieve per-paragraph.

- Invoked interactively as a Claude Code skill, not a CLI script.
- Pulls scholarly context from CandleKeep (external knowledge base).
- Runs **four broad-scope passes** over the full document (not per-paragraph):

  | Pass | Focus |
  |------|-------|
  | 1. Terminology / Glossary | Define key terms and concepts used in the text |
  | 2. Core Arguments | Identify and articulate the main philosophical claims |
  | 3. Main Concepts | Explain central ideas with elaboration and connections |
  | 4. Outline / Structure | Map the logical structure and argumentative flow |

- Produces the same card schema and targets the same Anki decks as the CLI path.
- Defaults to `--dry-run` so output can be reviewed before committing to Anki.

---

## Config reference

All config is resolved in `src/config.ts` via `loadConfig()`.

| Env var | Default | Description |
|---------|---------|-------------|
| `CARD_PROVIDER` | `gemini` | Provider to use: `gemini`, `claude`, or `mock` |
| `DRY_RUN` | `false` | Skip AnkiConnect writes when `true` |
| `PARENT_DECK` | `פילוסופיה פוליטית` | Root deck; subdecks created automatically |
| `DOCS_DIR` | `./docs` | Directory containing source text files |
| `ANKI_CONNECT_URL` | `http://127.0.0.1:8765` | AnkiConnect addon endpoint |
| `GOOGLE_API_KEY` | — | Gemini API key (alias: `GEMINI_API_KEY`) |
| `GEMINI_MODEL` | `gemini-2.5-pro` | Gemini model name |
| `CLAUDE_BIN` | `claude` | Path to `claude` CLI binary |
| `CLAUDE_MODEL` | — | Model override for the Claude CLI |
| `CLAUDE_TIMEOUT_MS` | `180000` | Timeout per Claude CLI call (ms) |
| `GEMINI_PROXY_URL` | `http://localhost:4000` | Legacy proxy URL (deprecated, not used by default) |

CLI flag overrides:

```bash
bun run process --provider claude --dry-run
```

---

## How this replaced the old proxy

Previously, `scripts/process.ts` called an external HTTP server (the "gemini-proxy") running at `localhost:4000`. The client code in `src/gemini-client.ts` sent paragraphs over HTTP and received cards back.

The refactor bakes generation directly into the repo:

| Aspect | Before | After |
|--------|--------|-------|
| Generation | External HTTP proxy process | In-process SDK call or CLI subprocess |
| Config | `GEMINI_PROXY_URL` | `CARD_PROVIDER` + `GOOGLE_API_KEY` |
| Switching backends | Not possible | `--provider claude\|mock` flag |
| Offline/test mode | Required a running proxy | `mock` provider — no dependencies |
| Card tagging | Inside proxy | Centralized `applyMetaTags()` in the repo |

`src/gemini-client.ts` is retained for back-compat only. The `legacyProxyUrl` config field preserves the `GEMINI_PROXY_URL` environment variable for anyone who still runs the old proxy. New work should use `CARD_PROVIDER=gemini`.
