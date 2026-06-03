# Anki Flashcard Generator

Generate Anki flashcards from political philosophy texts using AI.
Card generation is baked directly into this repo via a pluggable provider abstraction — no external proxy required.

## Project Structure

```
├── docs/                   # Source text files
├── scripts/
│   ├── process.ts          # Main processing script
│   └── retry-paragraphs.ts # Retry failed paragraphs
├── src/
│   ├── providers/
│   │   ├── types.ts        # CardProvider interface + applyMetaTags
│   │   ├── index.ts        # getProvider() factory
│   │   ├── gemini/         # Google Gemini SDK provider (default)
│   │   ├── claude/         # Headless Claude CLI provider
│   │   └── mock/           # Offline deterministic provider
│   ├── config.ts           # loadConfig(), resolveProviderName(), env defaults
│   ├── anki-client.ts      # AnkiConnect HTTP integration
│   ├── txt-processor.ts    # [Meta]/[Content] parser
│   └── logger.ts           # Logging utility
├── tests/                  # Bun test suite
├── .env.example            # All supported environment variables
├── ARCHITECTURE.md         # Architecture doc and data-flow diagram
└── CLAUDE.md               # Instructions for Claude Code sessions
```

## Prerequisites

1. **Anki** with the **AnkiConnect** addon installed and Anki running
2. An **Academic Philosophy** note type in Anki with fields: Front, Back, Context_Logic, Source_Snippet, Thinker_Work
3. For the **gemini** provider: a Google API key (see [env vars](#environment-variables) below)
4. For the **claude** provider: the `claude` CLI installed and authenticated with your Claude subscription

## Usage

```bash
# Process all files in docs/ with the default Gemini provider
bun run process

# Preview output without writing to Anki
bun run process --dry-run

# Use the Claude subscription provider
bun run process --provider claude

# Use the offline mock provider (no credentials needed)
bun run process --provider mock --dry-run

# Retry specific paragraph indices in a file
bun run scripts/retry-paragraphs.ts "filename" 3 7 12

# Run the test suite
bun test

# Type-check
bun run check
```

## Providers

Three card-generation backends are available, selected by `CARD_PROVIDER` or `--provider`:

| Provider | Description | Credentials |
|----------|-------------|-------------|
| `gemini` (default) | Google Gemini SDK — baked into the repo, stateful chat sessions per thinker/work, supports standard and deep (`---+`) modes | `GOOGLE_API_KEY` |
| `claude` | Headless `claude` CLI using your Claude subscription — no API key, per-paragraph generation | None |
| `mock` | Offline, deterministic — for tests and dry-runs | None |

## Environment Variables

Copy `.env.example` to `.env` and fill in the values relevant to your chosen provider.

| Variable | Default | Description |
|----------|---------|-------------|
| `CARD_PROVIDER` | `gemini` | Provider: `gemini`, `claude`, or `mock` |
| `DRY_RUN` | `false` | Skip AnkiConnect writes when `true` |
| `PARENT_DECK` | `פילוסופיה פוליטית` | Root Anki deck |
| `DOCS_DIR` | `./docs` | Directory with source text files |
| `ANKI_CONNECT_URL` | `http://127.0.0.1:8765` | AnkiConnect endpoint |
| `GOOGLE_API_KEY` | — | Gemini API key (gemini provider only) |
| `GEMINI_API_KEY` | — | Alternative to `GOOGLE_API_KEY` |
| `GEMINI_MODEL` | `gemini-2.5-pro` | Gemini model |
| `CLAUDE_BIN` | `claude` | Path to the `claude` CLI binary |
| `CLAUDE_MODEL` | — | Model override for the Claude CLI |
| `CLAUDE_TIMEOUT_MS` | `180000` | Timeout per Claude CLI call (ms) |

## Text File Format

Place `.txt` files (or extensionless files) in `docs/` with this structure:

```
[Meta]
thinker: אריסטו
work: פוליטיקה
chapter: ספר א
domain: political

[Content]
---
First paragraph text...

---
Second paragraph text...

---+
This paragraph is in deep mode — generates more cards (3–6+).

---
[[SUB_DECK - Ethics]]
This paragraph's cards go into the "Ethics" subdeck.
```

**Separator types:**
- `---` — standard paragraph (1–3 cards)
- `---+` — deep mode paragraph (3–6+ cards, more coverage)

**Supported meta fields:**
- `thinker` (required) — philosopher name, e.g. `קאנט` or `Kant`
- `work` (required) — text title
- `chapter` (optional) — chapter or section
- `domain` (optional) — inferred from thinker if omitted (`קאנט`/`Kant` → `kant`, others → `political`)

**SUB_DECK annotation:**
Add `[[SUB_DECK - Name]]` on its own line inside a paragraph to route that paragraph's cards to a named subdeck (`PARENT_DECK::Name`). The line itself is stripped from the card content.

## Card Schema

Each generated card conforms to `GeneratedFlashcard`:

```ts
{
  type: 'Concept' | 'Argument' | 'Context' | 'Contrast';
  front: string;
  back: string;
  context_logic: string;
  tags: string[];   // normalized: spaces replaced with _
}
```

Tags always include: `type`, `thinker`, `work`, and `chapter` (if set).

## Claude Code Skill

A separate in-repo skill at `.claude/skills/generate-cards/` provides a document-scope generation path via Claude Code. It:
- Pulls scholarly context from CandleKeep
- Runs four broad-scope passes (terminology, core arguments, main concepts, outline)
- Targets the same decks and card schema as the CLI scripts
- Defaults to dry-run

See `.claude/skills/generate-cards/` for details.

## Testing

```bash
bun test
```

Tests live in `tests/` and are discovered automatically by Bun. They have no external dependencies — the mock provider and a temp-dir fixture approach ensure everything runs offline.

## Further Reading

- [ARCHITECTURE.md](./ARCHITECTURE.md) — data-flow diagram, provider details, config reference, comparison with the old proxy
- [CLAUDE.md](./CLAUDE.md) — instructions for Claude Code sessions working in this repo
- [.env.example](./.env.example) — all supported environment variables with comments
