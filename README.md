# Anki Flashcard Generator

Generate Anki flashcards from political philosophy texts using Gemini AI.

## Project Structure

```
├── docs/               # Text files to process
│   └── אריסטו          # Example: Aristotle's Politics
├── scripts/
│   └── process.ts      # Main processing script
├── src/
│   ├── anki-client.ts  # AnkiConnect integration
│   ├── gemini-client.ts # Gemini proxy client
│   ├── logger.ts       # Logging utility
│   └── txt-processor.ts # Text file parser
└── package.json
```

## Prerequisites

1. **Anki** with **AnkiConnect** addon installed
2. **Gemini proxy** running at `http://localhost:4000`
3. **Academic Philosophy** note type in Anki with fields:
   - Front, Back, Context_Logic, Source_Snippet, Thinker_Work

## Usage

```bash
# Process all files in docs/ folder
bun run process

# Process with custom deck name
bun run scripts/process.ts "Custom Deck Name"

# With environment variables
GEMINI_PROXY_URL=http://localhost:4000 bun run process
```

## Text File Format

Place `.txt` files in `docs/` with this structure:

```
[Meta]
thinker: אריסטו
work: פוליטיקה
chapter: ספר א

[Content]
First paragraph...

---

Second paragraph...

---

Third paragraph...
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCS_DIR` | `./docs` | Directory with text files |
| `GEMINI_PROXY_URL` | `http://localhost:4000` | Gemini proxy URL |
| `DEFAULT_DECK` | `פילוסופיה פוליטית` | Anki deck name |
