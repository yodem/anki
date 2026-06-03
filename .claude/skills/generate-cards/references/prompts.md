# Broad-Scope Generation Pass Prompts (Hebrew)

These are the four prompt templates to use in Step 3 of the skill. Substitute `{THINKER}`, `{WORK}`, `{CHAPTER}`, `{FULL_TEXT}`, and `{CANDLEKEEP_CONTEXT}` with the actual values before sending.

---

## PASS_1 — Terminology / Glossary (type: Concept)

```
אתה מומחה לפילוסופיה ולמתודולוגיית לימוד Anki.

**משימה: סריקת מינוח ומושגי מפתח — מעבר שלם על הפרק**

הוגה: {THINKER}
יצירה: {WORK}
פרק: {CHAPTER}

הקשר מלומד (מ-CandleKeep):
{CANDLEKEEP_CONTEXT}

הטקסט המלא:
{FULL_TEXT}

**הנחיות Pass 1 — מינוח:**
- זהה את כל מונחי המפתח והמושגים הטכניים בפרק כולו (לא רק בפסקה אחת).
- עבור כל מונח, צור כרטיס אחד מסוג Concept.
- השאלה: "מה פירוש [מונח] אצל {THINKER}?" או "כיצד {THINKER} מגדיר את [מונח]?"
- התשובה: הגדרה מדויקת הנשענת על הטקסט והקשר המלומד.
- context_logic: כיצד המונח קשור למבנה הרעיוני הרחב של ההוגה.
- source_snippet: ציטוט מדויק מהטקסט שמגדיר את המונח, או ציטוט מלומד.
- לקאנט: חפש מונחים כמו רצון טוב, חובה, נטיית לב, כלל הפעולה, א-פריורי, א-פוסטריורי, פורמלי, מטריאלי, מתן כבוד, חוק מוסרי.

**פורמט תשובה — JSON בלבד:**
{
  "pass": "PASS_1_TERMINOLOGY",
  "flashcards": [
    {
      "type": "Concept",
      "front": "מה פירוש המושג '[מונח]' אצל {THINKER}?",
      "back": "[הגדרה מדויקת הכוללת את הרציונל]",
      "context_logic": "[הקשר למערכת הרעיונית של ההוגה]",
      "tags": ["Concept", "{THINKER}", "{WORK}", "[מונח]"],
      "source_snippet": "\"[ציטוט]\" ({THINKER}, {WORK}, {CHAPTER})"
    }
  ]
}
```

---

## PASS_2 — Core Arguments (type: Argument)

```
אתה מומחה לפילוסופיה ולמתודולוגיית לימוד Anki.

**משימה: טיעונים מרכזיים — מעבר שלם על הפרק**

הוגה: {THINKER}
יצירה: {WORK}
פרק: {CHAPTER}

הקשר מלומד (מ-CandleKeep):
{CANDLEKEEP_CONTEXT}

הטקסט המלא:
{FULL_TEXT}

**הנחיות Pass 2 — טיעונים:**
- זהה את כל הטיעונות והאסרטציות המרכזיות של הפרק כולו.
- עבור כל טיעון, צור כרטיס אחד מסוג Argument.
- השאלה: "מדוע, לפי {THINKER}, [תזה]?" או "כיצד {THINKER} מנמק ש...?"
- התשובה: הנחות הטיעון, מבנהו הלוגי והמסקנה, כולל הרציונל.
- context_logic: מיקום הטיעון בפרויקט הפילוסופי הרחב של ההוגה; ויכוח מלומד רלוונטי.
- source_snippet: המשפט המרכזי בטקסט שמנסח את הטיעון בצורה החדה ביותר.
- כוון ל-3-6 כרטיסי טיעון לפרק, לא אחד לכל פסקה.

**פורמט תשובה — JSON בלבד:**
{
  "pass": "PASS_2_ARGUMENTS",
  "flashcards": [
    {
      "type": "Argument",
      "front": "מדוע, לפי {THINKER}, [תזה]?",
      "back": "[הנחות, מבנה לוגי, מסקנה]",
      "context_logic": "[מיקום בפרויקט הפילוסופי, ויכוח מלומד]",
      "tags": ["Argument", "{THINKER}", "{WORK}", "core-argument"],
      "source_snippet": "\"[ציטוט מרכזי]\" ({THINKER}, {WORK}, {CHAPTER})"
    }
  ]
}
```

---

## PASS_3 — Main Concepts and Relations (type: Concept / Contrast)

```
אתה מומחה לפילוסופיה ולמתודולוגיית לימוד Anki.

**משימה: מושגים ויחסים מרכזיים — מעבר שלם על הפרק**

הוגה: {THINKER}
יצירה: {WORK}
פרק: {CHAPTER}

הקשר מלומד (מ-CandleKeep):
{CANDLEKEEP_CONTEXT}

הטקסט המלא:
{FULL_TEXT}

**הנחיות Pass 3 — מושגים ויחסים:**
- זהה את כל ההבחנות, ההשוואות, וזוגות המושגים המשמעותיים בפרק.
- עבור כל הבחנה: צור כרטיס מסוג Contrast.
- עבור כל מושג עם תפקיד יחסי (מושג שמוגדר ביחס לאחרים): כרטיס Concept.
- השאלה (Contrast): "מה ההבדל בין [X] ל-[Y] אצל {THINKER}?"
- השאלה (Concept): "כיצד {THINKER} מציב את [מושג] בתוך המערכת?"
- לקאנט בפרק זה: חפש: רצון טוב vs. כישרונות, חובה vs. נטיית לב, פעולה מתוך חובה vs. בהתאם לחובה, פורמלי vs. מטריאלי, א-פריורי vs. א-פוסטריורי.
- context_logic: מדוע ההבחנה הזו חשובה פילוסופית.

**פורמט תשובה — JSON בלבד:**
{
  "pass": "PASS_3_CONCEPTS_RELATIONS",
  "flashcards": [
    {
      "type": "Contrast",
      "front": "מה ההבדל בין [X] ל-[Y] אצל {THINKER}?",
      "back": "[ההבחנה, עם ניואנס מהמקורות המלומדים]",
      "context_logic": "[מדוע ההבחנה חשובה פילוסופית]",
      "tags": ["Contrast", "{THINKER}", "{WORK}", "[X]", "[Y]"],
      "source_snippet": "\"[ציטוט שמנסח את ההבחנה]\" ({THINKER}, {WORK}, {CHAPTER})"
    }
  ]
}
```

---

## PASS_4 — Outline / Structure / Flow (type: Context)

```
אתה מומחה לפילוסופיה ולמתודולוגיית לימוד Anki.

**משימה: מבנה הפרק וזרימת הטיעון — מעבר שלם**

הוגה: {THINKER}
יצירה: {WORK}
פרק: {CHAPTER}

הקשר מלומד (מ-CandleKeep):
{CANDLEKEEP_CONTEXT}

הטקסט המלא:
{FULL_TEXT}

**הנחיות Pass 4 — מבנה:**
- תאר את הפרק ברמת המבנה: כיצד נפתח, מה שלבי הטיעון, כיצד מסתיים.
- צור כרטיסי Context על:
  1. "מפת הדרכים" — כרטיס אחד: "מה הנושאים המרכזיים של [פרק/חלק] זה ובאיזה סדר הם מוצגים?"
  2. מעברים מרכזיים — כרטיס לכל מעבר לוגי משמעותי: "כיצד מוביל {THINKER} מ-[X] אל [Y]?"
  3. תפקיד חלקים — כרטיס לכל חלק שיש לו תפקיד ספציפי בטיעון: "מה תפקידה של הדוגמה על [X] בטיעון?"
  4. שיטה — כרטיס על המתודה: "מה השיטה הפילוסופית שבה {THINKER} משתמש בפרק זה?"
- context_logic: כיצד המבנה משקף את שיטת ההוגה (למשל, השיטה הרגרסיבית של קאנט ב'הנחות יסוד').

**פורמט תשובה — JSON בלבד:**
{
  "pass": "PASS_4_STRUCTURE",
  "flashcards": [
    {
      "type": "Context",
      "front": "מה הנושאים המרכזיים של [פרק זה] ובאיזה סדר הם מוצגים?",
      "back": "[תיאור מבנה הפרק: פתיחה, שלבי טיעון, סיום]",
      "context_logic": "[כיצד המבנה משקף את שיטת ההוגה — הקשר מלומד]",
      "tags": ["Context", "{THINKER}", "{WORK}", "structure", "outline"],
      "source_snippet": "[Author, Title, Year] — [תיאור קצר של מבנה הפרק לפי המקור המלומד]"
    }
  ]
}
```

---

## CandleKeep Research Query Template

Use this when invoking `candlekeep-cloud:candlekeep` in Step 2:

```
Research query: "{THINKER} — {WORK}, {CHAPTER}"

Please provide:
1. A 2-4 sentence scholarly summary of the main argument of this section.
2. A list of key technical terms used in this section with their standard scholarly definitions.
3. At least 2 scholarly sources (commentaries, secondary literature) with full citations.
4. Any notable debates or interpretive controversies around this section.
5. If available: the Hebrew translation context (who translated, any translation-specific terminology choices).

Focus: {THINKER}'s moral/political philosophy, specifically this section's contribution.
```
