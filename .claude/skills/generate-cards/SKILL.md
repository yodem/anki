---
name: generate-cards
description: >
  Generates high-coverage Anki flashcards from Hebrew philosophy texts in docs/,
  using CandleKeep for scholarly grounding and running four explicit broad-scope
  generation passes at document/section scope. Trigger phrases: "generate cards",
  "make flashcards", "enrich anki", "broad scope cards", "generate anki",
  "create cards from", "flashcards for".
---

# generate-cards — Broad-Scope Anki Flashcard Generator

## Purpose

The existing Gemini pipeline (`bun run process`) is **paragraph-atomized** — it generates 1-2 cards per paragraph. This skill fixes coverage gaps by working at **document/section scope**, running four mandatory broad-scope passes, and grounding every card in real scholarship via CandleKeep.

This skill runs inside an interactive Claude Code session. No Gemini API key required — it uses your Claude subscription. Output is written as JSON to `.cache/` in the same schema the CLI uses, making it fully interchangeable.

---

## Step 1 — Select Input Document

1. List all files in `docs/` and display them numbered.
2. Ask the user which file (or section) to process, or proceed with all if they said "all".
3. Read the chosen file and parse:
   - **`[Meta]` block**: extract `thinker`, `work`, `chapter`, `domain`.
   - **`[Content]` block**: split by `---` / `---+` separators into paragraphs. Note any `[[SUB_DECK - x]]` markers per paragraph.
4. Confirm back to the user: "Processing: `<work>` by `<thinker>`, `<chapter>`, `<N>` paragraphs."

**File format reminder:**
```
[Meta]
thinker: קאנט
work: הנחות יסוד למטפיזיקה של המידות
chapter: חלק ראשון ע׳ 42-61
domain: kant

[Content]
---
<paragraph text>
---+
<paragraph text with deep mode>
```

---

## Step 2 — Gather Scholarly Context via CandleKeep

**BLOCKING: Do this before generating any cards.**

Invoke the `candlekeep-cloud:candlekeep` skill with a research query targeting:
- The thinker's biography and intellectual context
- The specific work being studied (its place in the corpus, reception, key commentaries)
- The core technical vocabulary and concepts appearing in this text/section
- Relevant secondary scholarship (commentators, critics, translators into Hebrew)

**Capture and record:**
- A 2-4 sentence scholarly summary of the section's main argument
- A list of key terms with their standard scholarly definitions
- At least 2 citation references (author/title/year) to anchor the cards' `context_logic` fields

If CandleKeep returns insufficient results for the specific work, use the Sefaria MCP tools (`mcp__claude_ai_Sefaria__text_search`, `mcp__claude_ai_Sefaria__get_topic_details`) as a fallback for Jewish philosophical texts.

Store the gathered context in working memory — you will inject it into every generation pass below.

---

## Step 3 — Run Four Broad-Scope Generation Passes

**These passes are the core coverage fix.** Each pass operates at the full document/section scope, not paragraph-by-paragraph. Run all four sequentially.

### Pass 1: Terminology / Glossary — Type `Concept`

**Scope:** Every key term and technical vocabulary item in the entire section.

For each term:
- `front`: "מה פירוש המושג X אצל [הוגה]?" or "כיצד [הוגה] מגדיר את X?"
- `back`: Precise definition grounded in the text + CandleKeep scholarly context
- `context_logic`: How this term relates to the thinker's broader system
- `tags`: `["Concept", "<thinker>", "<work>", "<term>"]`
- `source_snippet`: A grounding quote from the text (or CandleKeep citation if none)
- `type`: `"Concept"`

Aim for **one card per distinct term**. For Kant texts, expect 8-15 terms per section.

Use the prompt template in `references/prompts.md § PASS_1`.

---

### Pass 2: Core Arguments — Type `Argument`

**Scope:** The work's central theses and their justifications, at whole-document scope.

For each major argument:
- `front`: "מדוע, לפי [הוגה], [thesis statement]?" or "כיצד [הוגה] מנמק ש...?"
- `back`: The argument's premises, logical structure, and conclusion
- `context_logic`: Where this argument stands in the thinker's overall project; scholarly debate
- `tags`: `["Argument", "<thinker>", "<work>", "core-argument"]`
- `source_snippet`: Key sentence from the text that states the argument most clearly
- `type`: `"Argument"`

Aim for **one card per distinct thesis**, not per paragraph. For a typical section, expect 3-6 core argument cards.

Use the prompt template in `references/prompts.md § PASS_2`.

---

### Pass 3: Main Concepts and Relations — Type `Concept` / `Contrast`

**Scope:** How the major ideas of the section relate to each other and to adjacent concepts in the thinker's corpus.

For each conceptual relation:
- If defining a concept: type `"Concept"`, front as "מה ההבדל בין X ל-Y אצל [הוגה]?"
- If contrasting: type `"Contrast"`, front as "כיצד [הוגה] מבדיל בין X לבין Y?"
- `back`: The distinction or relation, with nuance from CandleKeep commentary
- `context_logic`: Why this distinction matters philosophically
- `source_snippet`: The passage or phrase that makes the distinction explicit

Aim for **all significant concept pairs and hierarchies** in the section. For Kant, include pairs like: רצון טוב / אינסטינקט, חובה / נטיית לב, פורמלי / מטריאלי, א-פריורי / א-פוסטריורי.

Use the prompt template in `references/prompts.md § PASS_3`.

---

### Pass 4: Outline / Structure / Flow — Type `Context`

**Scope:** The section's internal organization — how the parts connect, what follows from what, the rhetorical and argumentative structure.

For each structural feature:
- `front`: "מה תפקידו של חלק X במבנה הפרק?" or "כיצד מוביל [הוגה] מ-X אל Y?"
- `back`: The structural role, the logical transition, what the reader is supposed to take away
- `context_logic`: How this structure reflects the thinker's method (e.g., Kant's regressive method in the Groundwork)
- `tags`: `["Context", "<thinker>", "<work>", "structure"]`
- `source_snippet`: CandleKeep citation or summary that names/describes this structure
- `type`: `"Context"`

Also include: a "roadmap" card ("מה הנושאים המרכזיים של [פרק/חלק] זה?") and any signpost cards for major transitions in the argument.

Use the prompt template in `references/prompts.md § PASS_4`.

---

### Plus: Normal Per-Paragraph Cards

After the four broad passes, optionally generate standard per-paragraph cards (1-2 per paragraph, as the Gemini pipeline does) for paragraphs not fully covered by the passes above. Use the quality rules below.

---

## Card Quality Rules

Apply to every card from every pass:

1. **Atomicity**: one idea per card, no compound questions.
2. **Active phrasing**: use "למה", "איך", "מה ההבדל" — not "מי" or "מהו".
3. **Academic precision**: do not simplify in ways that distort the original meaning. Use the thinker's own terminology.
4. **Include rationale**: `back` always includes the *why*, not just the *what*.
5. **Fill `context_logic`**: never leave it empty; inject CandleKeep scholarly context here.
6. **Hebrew by default**: all `front`, `back`, `context_logic` content in Hebrew.
7. **Tags**: always include `[type, thinker, work, key-term]` at minimum.
8. **`source_snippet`**: for broad-scope cards, use a grounding quote from the text; for purely structural/terminological cards with no single source sentence, use a CandleKeep citation string in format `"[Author, Title, Year]"`.

---

## Step 4 — Compile and Show Summary

After all passes, show the user:
- Total cards generated, broken down by pass and type
- A sample of 2-3 cards from each pass (front + back only)
- Any coverage gaps noticed (concepts mentioned in text not covered by any card)

Ask the user: "Should I push these to Anki, or save to `.cache/` only (dry run)?"

---

## Step 5 — Write to Cache (Default) / Push to Anki (Explicit Confirmation Only)

### DRY-RUN IS THE DEFAULT — NEVER PUSH WITHOUT EXPLICIT USER CONFIRMATION

**Always write to `.cache/` first.** Generate a filename:

```
<filename_sanitized>_claude_skill_<timestamp>.json
```

Where `<filename_sanitized>` replaces non-alphanumeric characters with `_` (same pattern as `process.ts`).

**Cache JSON shape** (mirrors `process.ts` exactly, with skill additions):

```json
{
  "section": "<full section title or filename>",
  "meta": {
    "thinker": "קאנט",
    "work": "הנחות יסוד למטפיזיקה של המידות",
    "chapter": "חלק ראשון ע׳ 42-61",
    "domain": "kant"
  },
  "flashcards": [ ... ],
  "source": "claude-skill",
  "candlekeep_citations": [ "Author, Title, Year", "..." ],
  "timestamp": "2026-06-03T12:00:00.000Z"
}
```

Each flashcard in the array:

```json
{
  "type": "Concept",
  "front": "...",
  "back": "...",
  "context_logic": "...",
  "tags": ["Concept", "קאנט", "הנחות יסוד", "רצון טוב"],
  "source_snippet": "\"...quote from text...\" (קאנט, הנחות יסוד, חלק ראשון)"
}
```

**`source_snippet` for broad-scope cards:** If the card covers the whole section (Pass 2 core arguments, Pass 4 structure), use the most representative sentence from the text as the quote. If no single sentence suffices, use the CandleKeep citation: `"[Author, Title, Year] — <1-line summary>"`. On push, this maps directly to AnkiConnect's `Source_Snippet` field.

---

### Pushing to Anki (only when user explicitly confirms)

1. Verify AnkiConnect is reachable at `http://127.0.0.1:8765` (send `{"action":"version","version":6,"params":{}}`).
2. Ensure the deck exists — `createDeck` action for both parent and subdeck:
   - Parent: `פילוסופיה פוליטית` (or user-specified `PARENT_DECK`)
   - Subdeck: `פילוסופיה פוליטית::<thinker>-<work>[-<chapter>]`
3. For each card, call `addNote` with:
   ```json
   {
     "action": "addNote",
     "version": 6,
     "params": {
       "note": {
         "deckName": "פילוסופיה פוליטית::<thinker>-<work>",
         "modelName": "Academic Philosophy",
         "fields": {
           "Front": "<card.front>",
           "Back": "<card.back>",
           "Context_Logic": "<card.context_logic>",
           "Source_Snippet": "<card.source_snippet>",
           "Thinker_Work": "<thinker> - <work> (<chapter>)"
         },
         "tags": ["<card.tags>"],
         "options": {
           "allowDuplicate": false,
           "duplicateScope": "deck"
         }
       }
     }
   }
   ```
4. Report results: N added, N skipped (duplicates), N failed (with errors).

---

## Relationship to `bun run process` (the Gemini CLI path)

| | `bun run process` (Gemini) | `generate-cards` skill (Claude) |
|---|---|---|
| **Cost** | Gemini API credits | Claude subscription |
| **Scope** | Per-paragraph | Document/section scope |
| **Coverage** | 1-2 cards/paragraph | 4 broad passes + per-paragraph |
| **Scholarly grounding** | None (raw text only) | CandleKeep citations |
| **Cache schema** | `{paragraph, meta, flashcards, timestamp}` | Same + `source`, `candlekeep_citations`, `source_snippet` per card |
| **Deck/model** | `Academic Philosophy` | Same |
| **AnkiConnect** | Auto-push | Dry-run default, push on confirmation |

Both paths produce the same card schema (`type`, `front`, `back`, `context_logic`, `tags`) and target the same Anki decks. Cache files from either path can be replayed via `retry-paragraphs.ts`.
