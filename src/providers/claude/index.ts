/**
 * Claude CLI card provider.
 *
 * Generates Anki flashcards by invoking the user's `claude` CLI
 * (subscription-backed, no API key required). One paragraph in → JSON out.
 *
 * Signal/timeout strategy:
 *   - AbortSignal.timeout(config.timeoutMs) always set.
 *   - opts.signal merged via AbortSignal.any() when provided.
 *   - Combined signal wired to Bun.spawn `signal` option.
 *   - After process exit: if signal aborted → throw timeout/cancel error.
 *   - If exitCode !== 0 → throw with stderr snippet.
 *
 * Model flag: [bin, '-p', PROMPT, '--model', model] when config.model is set.
 * Output format: default text (NOT --output-format json — that wraps the
 * response in the CLI's own envelope, not the model's JSON).
 */

import type { CardProvider, GenerateOptions, GeneratedFlashcard, DocumentMeta } from '../types';
import type { ClaudeConfig } from '../../config';
import { logger } from '../../logger';

// ── Card type guard ─────────────────────────────────────────────────────────

const VALID_TYPES = new Set(['Concept', 'Argument', 'Context', 'Contrast']);

function isValidType(v: unknown): v is GeneratedFlashcard['type'] {
  return typeof v === 'string' && VALID_TYPES.has(v);
}

// ── Response cleaning ───────────────────────────────────────────────────────

/**
 * Strip optional ```json / ``` fences and surrounding whitespace.
 * Also extracts the outermost JSON object when the model prepends prose.
 */
function cleanResponseText(text: string): string {
  let s = text.trim();

  // Strip code fences
  if (s.startsWith('```json')) s = s.replace(/^```json\s*/, '');
  else if (s.startsWith('```')) s = s.replace(/^```\s*/, '');
  if (s.endsWith('```')) s = s.replace(/\s*```$/, '');

  s = s.trim();

  // If plain JSON parse would fail (prose prefix), extract {…} substring
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace > 0 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }

  return s;
}

// ── Prompt builder ──────────────────────────────────────────────────────────

function buildPrompt(
  paragraph: string,
  meta: DocumentMeta,
  opts: GenerateOptions
): string {
  const lang = opts.language ?? 'he';
  const extraCards = opts.extraCards ?? false;

  if (lang === 'en') {
    const chapterInfo = meta.chapter ? `Chapter: ${meta.chapter}\n` : '';
    const cardCountInstructions = extraCards
      ? `\n⚠️ DEEP ANALYSIS MODE:\n- Generate flashcards for every aspect, nuance and context\n- Look for primary concepts, secondary ideas, examples, implications\n- A typical passage should generate 3-6 flashcards in this mode\n`
      : `\n⚠️ STANDARD MODE:\n- Identify the 1-2 main ideas in the passage\n- Create one flashcard if focused on a single concept\n- Create 2 flashcards if the passage contains two distinct ideas\n`;

    return `You are an expert in political philosophy and knowledgeable in Anki learning methodology. Your task is to analyze paragraphs from academic texts and create high-quality flashcards (Anki-style).

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

Return ONLY a JSON object — no prose, no markdown fences — with this structure:
{
  "flashcards": [
    {
      "type": "Argument",
      "front": "Why does [thinker] argue that [specific question from text]?",
      "back": "[Concise answer including the rationale]",
      "context_logic": "[Explanation of the internal logic and connection to the thinker's theory]",
      "tags": ["key concept"]
    }
  ]
}

Text Information:
Thinker: ${meta.thinker}
Work: ${meta.work}
${chapterInfo}
Paragraph to analyze:
${paragraph}
${cardCountInstructions}`;
  }

  // Hebrew (default)
  const chapterInfo = meta.chapter ? `פרק: ${meta.chapter}\n` : '';
  const cardCountInstructions = extraCards
    ? `
⚠️ חשוב מאוד - מצב ניתוח מעמיק (Extra Cards Mode):
- נדרש ניתוח מעמיק ויסודי של הפסקה
- צור כרטיסים עבור כל היבט, ניואנס והקשר בפסקה
- חפש רעיונות משניים, השלכות, דוגמאות והבחנות עדינות
- פסקה טיפוסית תייצר 3-6 כרטיסים במצב זה
- כל פרט פילוסופי משמעותי ראוי לכרטיס נפרד
`
    : `
⚠️ חשוב מאוד - כמות כרטיסים:
- בדרך כלל, פסקה מכילה 1-2 רעיונות מרכזיים
- צור כרטיס אחד אם הפסקה מתמקדת ברעיון בודד
- צור 2 כרטיסים אם הפסקה מכילה שני רעיונות נפרדים
- אל תכפה יצירת כרטיסים מרובים אם הפסקה עוסקת ברעיון אחד
`;

  return `אתה מומחה לפילוסופיה פוליטית ומומחה למתודולוגיית הלמידה Anki. תפקידך לנתח פסקאות מתוך טקסטים אקדמיים וליצור מהם כרטיסי זיכרון (Flashcards) איכותיים.

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

החזר אובייקט JSON בלבד — ללא פרוזה, ללא גדרות markdown — עם המבנה הבא:
{
  "flashcards": [
    {
      "type": "Argument",
      "front": "מדוע, לפי [שם ההוגה], [שאלה ספציפית מהטקסט]?",
      "back": "[תשובה תמציתית הכוללת את הרציונל]",
      "context_logic": "[הסבר על הלוגיקה הפנימית]",
      "tags": ["מושג מפתח"]
    }
  ]
}

מידע על הטקסט:
הוגה: ${meta.thinker}
יצירה: ${meta.work}
${chapterInfo}
הפסקה לניתוח:
${paragraph}
${cardCountInstructions}

הנחיות נוספות:
- ודא שכל כרטיס עומד בפני עצמו ומובן ללא הפסקה המקורית
- השתמש במונחים המקוריים של ההוגה כשרלוונטי
- אל תכלול כל הסבר נוסף או טקסט מחוץ לפורמט JSON
- אל תוסיף סימני קוד (\`\`\`) או כל עיצוב markdown אחר
- החזר JSON נקי לחלוטין`;
}

// ── Provider ────────────────────────────────────────────────────────────────

export class ClaudeCardProvider implements CardProvider {
  readonly name = 'claude';
  private readonly config: ClaudeConfig;

  constructor(config: ClaudeConfig) {
    this.config = config;
  }

  async generateFlashcards(
    paragraph: string,
    meta: DocumentMeta,
    opts: GenerateOptions = {}
  ): Promise<GeneratedFlashcard[]> {
    const prompt = buildPrompt(paragraph, meta, opts);

    // Build argv
    const argv: string[] = [this.config.bin, '-p', prompt];
    if (this.config.model) {
      argv.push('--model', this.config.model);
    }

    // Combine abort signals
    const signals: AbortSignal[] = [AbortSignal.timeout(this.config.timeoutMs)];
    if (opts.signal) signals.push(opts.signal);
    const combinedSignal = signals.length === 1 ? signals[0]! : AbortSignal.any(signals);

    logger.debug(`[claude-provider] spawning: ${this.config.bin}${this.config.model ? ` --model ${this.config.model}` : ''}`);

    let proc: ReturnType<typeof Bun.spawn>;
    try {
      proc = Bun.spawn(argv, {
        stdout: 'pipe',
        stderr: 'pipe',
        signal: combinedSignal,
      });
    } catch (err) {
      throw new Error(
        `[claude-provider] failed to spawn ${this.config.bin}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Drain stdout and stderr concurrently BEFORE awaiting exit to avoid pipe deadlock.
    // With stdout: 'pipe' / stderr: 'pipe', Bun always provides ReadableStream.
    // The @types/bun union includes `number` for fd-inherited cases; cast to narrow.
    const [stdoutText, stderrText] = await Promise.all([
      new Response(proc.stdout as ReadableStream).text(),
      new Response(proc.stderr as ReadableStream).text(),
    ]);

    const exitCode = await proc.exited;

    // Signal aborted → timeout or caller cancellation
    if (combinedSignal.aborted) {
      const reason =
        opts.signal?.aborted && opts.signal.reason
          ? `caller cancelled: ${String(opts.signal.reason)}`
          : `timed out after ${this.config.timeoutMs}ms`;
      throw new Error(`[claude-provider] ${reason}`);
    }

    if (exitCode !== 0) {
      const snippet = stderrText.trim().slice(0, 300);
      throw new Error(
        `[claude-provider] claude CLI exited with code ${exitCode}. stderr: ${snippet}`
      );
    }

    logger.debug(`[claude-provider] stdout length: ${stdoutText.length}`);

    // Parse response
    return parseCards(stdoutText);
  }
}

// ── Parsing ─────────────────────────────────────────────────────────────────

function parseCards(raw: string): GeneratedFlashcard[] {
  let parsed: unknown;
  try {
    const cleaned = cleanResponseText(raw);
    parsed = JSON.parse(cleaned);
  } catch {
    logger.warn('[claude-provider] JSON parse failed; returning []');
    return [];
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('flashcards' in parsed) ||
    !Array.isArray((parsed as Record<string, unknown>)['flashcards'])
  ) {
    logger.warn('[claude-provider] response has no flashcards array; returning []');
    return [];
  }

  const rawCards = (parsed as Record<string, unknown>)['flashcards'] as unknown[];

  const valid: GeneratedFlashcard[] = [];
  for (const card of rawCards) {
    if (
      typeof card !== 'object' ||
      card === null ||
      !isValidType((card as Record<string, unknown>)['type']) ||
      typeof (card as Record<string, unknown>)['front'] !== 'string' ||
      typeof (card as Record<string, unknown>)['back'] !== 'string'
    ) {
      logger.debug('[claude-provider] skipping invalid card', card);
      continue;
    }

    const c = card as Record<string, unknown>;
    const context_logic =
      typeof c['context_logic'] === 'string' ? c['context_logic'] : '';
    const tags =
      Array.isArray(c['tags'])
        ? (c['tags'] as unknown[]).filter((t): t is string => typeof t === 'string')
        : [];

    valid.push({
      type: c['type'] as GeneratedFlashcard['type'],
      front: (c['front'] as string).trim(),
      back: (c['back'] as string).trim(),
      context_logic,
      tags,
    });
  }

  logger.debug(`[claude-provider] valid cards: ${valid.length}`);
  return valid;
}
