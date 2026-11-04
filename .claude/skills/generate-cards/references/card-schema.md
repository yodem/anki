# Card Schema Reference

## JSON Schema for a Single Flashcard

```json
{
  "type": "Concept | Argument | Context | Contrast",
  "front": "string — the question, in Hebrew, active phrasing",
  "back": "string — the answer, in Hebrew, includes rationale",
  "context_logic": "string — scholarly context, internal logic, CandleKeep grounding",
  "tags": ["type-tag", "thinker", "work", "concept-key"],
  "source_snippet": "string — grounding quote or citation (see below)"
}
```

### `source_snippet` rules

- **Per-paragraph cards** (standard mode): `"\"<verbatim quote>\" (<thinker>, <work>, <chapter>)"`
- **Broad-scope cards** (Pass 1-4): use the most representative sentence from the text; if none fits, use `"[Author, Title, Year] — <1-line summary from CandleKeep>"`

This field maps directly to AnkiConnect's `Source_Snippet` Anki field on push.

### `Thinker_Work` field (computed at push time)

```
<thinker> - <work> (<chapter>)
```
Example: `קאנט - הנחות יסוד למטפיזיקה של המידות (חלק ראשון ע׳ 42-61)`

---

## Full Cache File Schema

```json
{
  "section": "מטלת קריאה 1 - הנחות יסוד - חלק ראשון ע׳ 42-61",
  "meta": {
    "thinker": "קאנט",
    "work": "הנחות יסוד למטפיזיקה של המידות",
    "chapter": "חלק ראשון ע׳ 42-61",
    "domain": "kant"
  },
  "flashcards": [
    {
      "type": "Concept",
      "front": "מה פירוש המושג 'רצון טוב' (guter Wille) אצל קאנט?",
      "back": "הרצון הטוב הוא הדבר היחיד הטוב ללא כל סייג. ערכו אינו תלוי בתוצאותיו, ביכולתו לממש כוונותיו, או בתועלת שהוא מניב — אלא בעצם הרצייה כשלעצמה, כאשר היא מוּנעת מחובה ולא מנטיות לב.",
      "context_logic": "מושג הרצון הטוב הוא נקודת המוצא של כל האתיקה הקאנטיאנית. הוא מבדיל בין ערך מוסרי לבין ערך תועלתי. ללא הרצון הטוב, כל שאר הכישרונות — שכל, אומץ, אושר — עלולים להיות לרעים. ראו: Korsgaard, Christine, Creating the Kingdom of Ends (1996), פרק 2.",
      "tags": ["Concept", "קאנט", "הנחות יסוד", "רצון טוב", "guter Wille"],
      "source_snippet": "\"אי-אפשר להעלות על הדעת דבר כלשהו בעולם, ואכן אף לא מחוצה לו, שיכול להיחשב לטוב ללא כל סייג, חוץ מרצון טוב\" (קאנט, הנחות יסוד, חלק ראשון)"
    }
  ],
  "source": "claude-skill",
  "candlekeep_citations": [
    "Korsgaard, Christine M. Creating the Kingdom of Ends. Cambridge University Press, 1996.",
    "Paton, H.J. The Categorical Imperative: A Study in Kant's Moral Philosophy. University of Pennsylvania Press, 1971."
  ],
  "timestamp": "2026-06-03T12:00:00.000Z"
}
```

---

## Card Type Reference

| Type | Use for | Typical front phrasing |
|------|---------|----------------------|
| `Concept` | Definitions, key terms, central ideas | "מה פירוש X?", "כיצד [הוגה] מגדיר X?" |
| `Argument` | Theses, justifications, proofs | "מדוע, לפי [הוגה], X?", "כיצד [הוגה] מנמק ש...?" |
| `Context` | Historical/philosophical background, structure | "מה תפקידו של X במבנה הטיעון?", "מה הקשר בין X לתורת [הוגה]?" |
| `Contrast` | Distinctions, comparisons, oppositions | "מה ההבדל בין X ל-Y?", "כיצד מבדיל [הוגה] בין X לבין Y?" |

---

## Deck Naming Convention

```
פילוסופיה פוליטית::<thinker>-<work>[-<chapter>]
```

Examples:
- `פילוסופיה פוליטית::קאנט-הנחות יסוד למטפיזיקה של המידות-חלק ראשון`
- `פילוסופיה פוליטית::קאנט-הנחות יסוד למטפיזיקה של המידות`

If the source file contains a `[[SUB_DECK - x]]` marker, that marker value overrides the default subdeck name for cards from that paragraph.
