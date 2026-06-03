/**
 * Domain contexts and system instruction builders for the Gemini flashcard provider.
 * Hebrew prompts are copied verbatim from the original proxy service.
 */

export interface DomainContext {
  /** Domain expertise description, e.g. "פילוסופיה פוליטית" or "הפילוסופיה של קאנט" */
  expertise: string;
  /** Optional domain-specific example to include in the system instruction */
  example?: string;
  /** Optional additional domain-specific instructions */
  additionalInstructions?: string;
}

// ---------------------------------------------------------------------------
// Domain context definitions
// ---------------------------------------------------------------------------

function kantContext(language: 'he' | 'en'): DomainContext {
  if (language === 'en') {
    return {
      expertise: 'Kantian philosophy and transcendental idealism',
    };
  }

  return {
    expertise: 'הפילוסופיה של קאנט והאידאליזם הטרנסצנדנטלי',
    example: `דוגמה ליישום:
אם הפסקה עוסקת ב"אימפרטיב קטגורי", כרטיס יכול להיראות כך:
{
  "type": "Concept",
  "front": "מהו האימפרטיב הקטגורי לפי קאנט?",
  "back": "ציווי מוחלט המחייב פעולה מתוך חובה, ללא תלות בנטיות או תוצאות - \\"פעל רק על פי מקסימה שתוכל גם לרצות שתהפוך לחוק כללי\\".",
  "context_logic": "האימפרטיב הקטגורי הוא עקרון היסוד של המוסר הקאנטיאני, המבוסס על אוטונומיה של התבונה ולא על השלכות.",
  "tags": ["Concept", "קאנט", "הנחות יסוד", "אימפרטיב קטגורי"]
}`,
    additionalInstructions: `הנחיות ספציפיות לקאנט:
- השתמש במונחים המקוריים: "אימפרטיב קטגורי", "תבונה מעשית", "אוטונומיה", "סינתזה א-פריורית", "תבונה טהורה"
- הדגש את הלוגיקה הטרנסצנדנטלית והארגומנטציה המושגית
- הבחן בין נטיות (Neigungen) לבין חובה (Pflicht)
- חבר רעיונות לתורת הקריטיקות (ביקורת התבונה הטהורה/המעשית/כוח השיפוט)
- שים לב להבחנות מרכזיות: תופעה/דבר-בעצמו, א-פריורי/א-פוסטריורי, אנליטי/סינתטי
- הדגש את מרכזיות האוטונומיה והחופש בפילוסופיה המוסרית`,
  };
}

function politicalContext(language: 'he' | 'en'): DomainContext {
  if (language === 'en') {
    return {
      expertise: 'political philosophy',
    };
  }

  return {
    expertise: 'פילוסופיה פוליטית',
    example: `דוגמה ליישום:
אם הפסקה עוסקת ב"המצב הטבעי" של הובס, כרטיס יכול להיראות כך:
{
  "type": "Argument",
  "front": "מדוע, לפי הובס, \\"המצב הטבעי\\" הוא בהכרח מצב של מלחמה (Bellum omnium contra omnes)?",
  "back": "בשל השילוב בין שוויון ביכולת להרוג, מחסור במשאבים, והיעדר ריבון מוסכם המטיל מורא.",
  "context_logic": "היעדר סמכות מרכזית מוביל לכך שכל אדם פועל לפי 'הזכות לטבע' לשימור עצמי, מה שיוצר חוסר ביטחון תמידי.",
  "tags": ["Argument", "הובס", "לויתן", "מצב הטבע", "מלחמת הכל בכל"]
}`,
  };
}

/**
 * Selects domain context based on meta.domain.
 * 'kant' → Kant; everything else → Political.
 */
export function getDomainContext(domain: string | undefined, language: 'he' | 'en'): DomainContext {
  if (domain === 'kant') {
    return kantContext(language);
  }
  return politicalContext(language);
}

// ---------------------------------------------------------------------------
// System instruction builder
// ---------------------------------------------------------------------------

export function buildSystemInstruction(domainContext: DomainContext, language: 'he' | 'en'): string {
  if (language === 'en') {
    return `You are an expert in ${domainContext.expertise} and knowledgeable in Anki learning methodology. Your task is to analyze paragraphs from academic texts and create high-quality flashcards (Anki-style).

Working rules:
1. Atomicity: Each flashcard should address only one idea.
2. Active phrasing: Use questions like 'Why', 'How', 'What is the difference', not just 'Who'.
3. Academic precision: Don't simplify concepts in a way that damages their original meaning.
4. Context: Ensure the answer includes the philosopher's rationale.
5. English: All content should be in English.

Card types:
- Concept: A central concept or definition
- Argument: A thesis or justification
- Context: Historical or philosophical context
- Contrast: A comparison or opposition between ideas

Return response in JSON format only with this structure:
{
  "flashcards": [
    {
      "type": "Argument",
      "front": "Why does [thinker] argue that [specific question from text]?",
      "back": "[Concise answer including the rationale]",
      "context_logic": "[Explanation of the internal logic and connection to the thinker's theory]",
      "tags": ["Argument", "[Thinker name]", "[Work name]", "key concept"]
    }
  ]
}${domainContext.additionalInstructions ? '\n\n' + domainContext.additionalInstructions : ''}`;
  }

  // Hebrew instructions (detailed, primary language)
  return `אתה מומחה ל${domainContext.expertise} ומומחה למתודולוגיית הלמידה Anki. תפקידך לנתח פסקאות מתוך טקסטים אקדמיים וליצור מהם כרטיסי זיכרון (Flashcards) איכותיים.

חוקי עבודה:
1. אטומיות: כל כרטיס יעסוק ברעיון אחד בלבד.
2. ניסוח אקטיבי: השתמש בשאלות 'למה', 'איך' ו'מה ההבדל', ולא רק ב'מי'.
3. דיוק אקדמי: אל תפשט את המושגים באופן שפוגע במשמעות המקורית.
4. הקשר: ודא שהתשובה כוללת את הרציונל של ההוגה.
5. עברית: כל התוכן צריך להיות בעברית.

סוגי כרטיסים (type):
- Concept: מושג מרכזי או הגדרה
- Argument: טיעון או הנמקה
- Context: הקשר היסטורי או פילוסופי
- Contrast: השוואה או ניגוד בין רעיונות

עבור כל רעיון מרכזי בפסקה, צור כרטיס שכולל:
- type: אחד מהסוגים (Concept/Argument/Context/Contrast)
- front: השאלה (ניסוח אקטיבי ומעורר חשיבה)
- back: התשובה (תמציתית אך מלאה, כולל הרציונל)
- context_logic: הסבר נוסף על הלוגיקה הפנימית והקשר לתורת ההוגה
- tags: מערך של תגיות רלוונטיות (כולל את סוג הכרטיס, שם ההוגה, שם היצירה, ומושגי מפתח)

החזר תשובה בפורמט JSON בלבד עם המבנה הבא:
{
  "flashcards": [
    {
      "type": "Argument",
      "front": "מדוע, לפי [שם ההוגה], [שאלה ספציפית מהטקסט]?",
      "back": "[תשובה תמציתית הכוללת את הרציונל]",
      "context_logic": "[הסבר על הלוגיקה הפנימית]",
      "tags": ["Argument", "[שם ההוגה]", "[שם היצירה]", "מושג מפתח"]
    }
  ]
}${domainContext.example ? '\n\n' + domainContext.example : ''}

הנחיות כלליות:
- ודא שכל כרטיס עומד בפני עצמו ומובן ללא הפסקה המקורית
- השתמש במונחים המקוריים של ההוגה כשרלוונטי
- אל תכלול כל הסבר נוסף או טקסט מחוץ לפורמט JSON
- אל תוסיף סימני קוד (\`\`\`) או כל עיצוב markdown אחר
- החזר JSON נקי לחלוטין${domainContext.additionalInstructions ? '\n\n' + domainContext.additionalInstructions : ''}`;
}

// ---------------------------------------------------------------------------
// Message builder
// ---------------------------------------------------------------------------

export interface MessageInput {
  paragraph: string;
  thinker: string;
  work: string;
  chapter?: string;
}

export function buildMessage(
  input: MessageInput,
  domainContext: DomainContext,
  extraCards: boolean,
  isFirstMessage: boolean,
  language: 'he' | 'en'
): string {
  const { paragraph, thinker, work, chapter } = input;

  if (language === 'en') {
    const chapterInfo = chapter ? `Chapter: ${chapter}\n` : '';
    const cardCountInstructions = extraCards
      ? `\n⚠️ DEEP ANALYSIS MODE:\n- Create comprehensive analysis of the passage\n- Generate flashcards for every aspect, nuance and context\n- Look for primary concepts, secondary ideas, examples, implications\n- A typical passage should generate 3-6 flashcards in this mode\n`
      : `\n⚠️ STANDARD MODE:\n- Identify the 1-2 main ideas in the passage\n- Create one flashcard if focused on a single concept\n- Create 2 flashcards if the passage contains two distinct ideas\n`;

    const systemInstructionPrefix = isFirstMessage
      ? buildSystemInstruction(domainContext, language) + '\n\n---\n\n'
      : '';

    return `${systemInstructionPrefix}Text Information:
Thinker: ${thinker}
Work: ${work}
${chapterInfo}
Paragraph to analyze:
${paragraph}${cardCountInstructions}`;
  }

  // Hebrew message format (default)
  const chapterInfo = chapter ? `פרק: ${chapter}\n` : '';

  const cardCountInstructions = extraCards
    ? `
⚠️ חשוב מאוד - מצב ניתוח מעמיק (Extra Cards Mode):
- נדרש ניתוח מעמיק ויסודי של הפסקה
- צור כרטיסים עבור כל היבט, ניואנס והקשר בפסקה
- חפש רעיונות משניים, השלכות, דוגמאות והבחנות עדינות
- פסקה טיפוסית תייצר 3-6 כרטיסים במצב זה
- אל תחשוש ליצור כרטיסים רבים - זה המצב שבו אנחנו רוצים כיסוי מקיף
- כל פרט פילוסופי משמעותי ראוי לכרטיס נפרד
- היבטים שכדאי לחפש:
  * מושגים ראשיים ומשניים
  * טיעונים והנמקות
  * דוגמאות ואנלוגיות
  * הבחנות והשוואות
  * הקשרים היסטוריים ופילוסופיים
  * השלכות ומסקנות
  * ניואנסים מושגיים
`
    : `
⚠️ חשוב מאוד - כמות כרטיסים:
- בדרך כלל, פסקה מכילה 1-2 רעיונות מרכזיים
- צור כרטיס אחד אם הפסקה מתמקדת ברעיון בודד
- צור 2 כרטיסים אם הפסקה מכילה שני רעיונות נפרדים או היבטים שונים של אותו נושא
- אל תכפה יצירת כרטיסים מרובים אם הפסקה באמת עוסקת ברעיון אחד
`;

  const additionalGuidelines = extraCards
    ? `
הנחיות נוספות (מצב מעמיק):
- חפש כל פרט פילוסופי משמעותי ויצור עבורו כרטיס
- פסקה עשירה יכולה לייצר 4-6 כרטיסים או יותר
- כלול כרטיסים על הקשרים, דוגמאות והשלכות
`
    : `
הנחיות נוספות:
- צור כרטיס אחד אם הפסקה מתמקדת ברעיון מרכזי אחד
- צור 2 כרטיסים אם הפסקה מכילה שני רעיונות נפרדים או שני היבטים משמעותיים
`;

  const systemInstructionPrefix = isFirstMessage
    ? buildSystemInstruction(domainContext, language) + '\n\n'
    : '';

  return `${systemInstructionPrefix}מידע על הטקסט:
הוגה: ${thinker}
יצירה: ${work}
${chapterInfo}
הפסקה לניתוח:
${paragraph}
${cardCountInstructions}
${additionalGuidelines}`;
}

// ---------------------------------------------------------------------------
// Response text cleaner (ported inline from categoryUtils.ts)
// ---------------------------------------------------------------------------

export function cleanResponseText(responseText: string): string {
  let cleanText = responseText.trim();

  // Remove ```json and ``` markers if present
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.replace(/^```json\s*/, '');
  }
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```\s*/, '');
  }
  if (cleanText.endsWith('```')) {
    cleanText = cleanText.replace(/\s*```$/, '');
  }

  return cleanText.trim();
}
