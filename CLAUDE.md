# CLAUDE.md — Anki Flashcard Generator

## Stack

- **Runtime**: Bun (not Node/npm/pnpm)
- **Language**: TypeScript (strict)
- **AI SDK**: `@google/generative-ai` for the Gemini provider
- **Card target**: Anki via AnkiConnect HTTP addon

## How to run

```bash
# Process all docs with the default gemini provider
bun run process

# Preview without writing to Anki (dry-run)
bun run process --dry-run

# Use the Claude subscription provider instead of Gemini
bun run process --provider claude --dry-run

# Use the offline mock provider (no credentials needed)
bun run process --provider mock --dry-run

# Retry specific paragraphs
bun run scripts/retry-paragraphs.ts "filename" 3 7 12

# Run tests (Bun auto-discovers tests/**/*.test.ts)
bun test

# Type-check — ALWAYS run before declaring work done
bun run check
```

## Provider model

The `CardProvider` interface (`src/providers/types.ts`) is the core abstraction.
The factory `getProvider(config)` in `src/providers/index.ts` resolves one of:

| Provider | Needs credentials? | Use case |
|----------|-------------------|----------|
| `gemini` | Yes — `GOOGLE_API_KEY` | Default production path |
| `claude` | No (uses CLI + subscription) | Alternative generation |
| `mock` | No | Tests, offline dry-runs |

Select via env var `CARD_PROVIDER` or the `--provider` flag.

## The generate-cards skill

The in-repo Claude Code skill at `.claude/skills/generate-cards/` is a separate, interactive generation path that:
- Pulls scholarly context from CandleKeep
- Runs four broad-scope passes (terminology, core arguments, main concepts, outline) at document scope — not per-paragraph
- Targets the same card schema and decks as the CLI scripts
- Defaults to dry-run mode

Invoke it as a Claude Code skill, not a CLI script.

## Conventions

- **Hebrew content**: source texts are in Hebrew; card prompts/responses use Hebrew by default (`language: 'he'`). The mock provider mirrors this.
- **Card schema** (`GeneratedFlashcard`):
  - `type`: `'Concept' | 'Argument' | 'Context' | 'Contrast'`
  - `front`, `back`, `context_logic`: all strings
  - `tags`: `string[]` — normalized to underscores (no spaces) by `applyMetaTags()`
- **Deep-mode paragraphs**: mark with `---+` in the source file to request extra cards. Standard paragraphs use `---`.
- **SubDeck**: add `[[SUB_DECK - Name]]` on its own line inside a paragraph to route cards to a named subdeck.
- **Caching**: raw card JSON is written to `.cache/` before AnkiConnect writes. Do not commit `.cache/`.

## Key source locations

| File | Purpose |
|------|---------|
| `src/providers/types.ts` | `CardProvider` interface, `applyMetaTags`, shared types |
| `src/providers/index.ts` | `getProvider()` factory — the primary seam |
| `src/providers/gemini/` | Baked-in Gemini SDK provider |
| `src/providers/claude/` | Headless CLI provider |
| `src/providers/mock/` | Offline deterministic provider |
| `src/config.ts` | `loadConfig()`, `resolveProviderName()`, all env var defaults |
| `src/txt-processor.ts` | `[Meta]`/`[Content]` parser, paragraph splitter |
| `src/anki-client.ts` | AnkiConnect HTTP integration |
| `scripts/process.ts` | Main CLI entrypoint |
| `tests/` | Bun tests — run with `bun test` |

## Before you're done

1. `bun run check` — TypeScript must be error-free.
2. `bun test` — all tests must pass.
3. Do not commit `.cache/`, `.env`, or any file containing API keys.
