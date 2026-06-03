/**
 * Mock card provider.
 *
 * Deterministic, fully offline. Produces structurally-valid flashcards derived
 * from the input paragraph so the full pipeline (parse → generate → tag →
 * dry-run AnkiConnect) can be exercised without any API key or network access.
 * Used by the test suite and by `CARD_PROVIDER=mock`.
 */

import type { CardProvider, GenerateOptions, GeneratedFlashcard, DocumentMeta } from '../types';

export class MockCardProvider implements CardProvider {
  readonly name = 'mock';

  async generateFlashcards(
    paragraph: string,
    meta: DocumentMeta,
    opts: GenerateOptions = {}
  ): Promise<GeneratedFlashcard[]> {
    const snippet = paragraph.trim().slice(0, 60).replace(/\s+/g, ' ');
    const he = (opts.language ?? 'he') === 'he';

    const base: GeneratedFlashcard = {
      type: 'Concept',
      front: he
        ? `מהו הרעיון המרכזי בקטע של ${meta.thinker}?`
        : `What is the central idea in this passage by ${meta.thinker}?`,
      back: he ? `(mock) ${snippet}…` : `(mock) ${snippet}…`,
      context_logic: he
        ? `כרטיס שנוצר במצב mock עבור ${meta.work}.`
        : `Mock-generated card for ${meta.work}.`,
      tags: [],
    };

    if (!opts.extraCards) return [base];

    // Deep mode: emit a small spread across card types for coverage testing.
    const second: GeneratedFlashcard = {
      type: 'Argument',
      front: he
        ? `כיצד ${meta.thinker} מנמק את עמדתו בקטע זה?`
        : `How does ${meta.thinker} justify the claim in this passage?`,
      back: he ? `(mock) הנמקה עבור: ${snippet}…` : `(mock) Rationale for: ${snippet}…`,
      context_logic: he ? 'לוגיקה פנימית (mock).' : 'Internal logic (mock).',
      tags: [],
    };
    return [base, second];
  }
}
