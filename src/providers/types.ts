/**
 * Card provider contract.
 *
 * A CardProvider turns a single source paragraph (plus document metadata) into
 * one or more flashcards. The concrete implementations are:
 *   - gemini : baked-in Google Gemini SDK calls (ported from the old proxy)
 *   - claude : the user's Claude subscription, via the headless `claude` CLI
 *   - mock   : deterministic, offline provider for dry-runs and tests
 *
 * The richer, broad-scope (terminology / core-arguments / outline) generation
 * lives in the in-repo Claude Code skill at `.claude/skills/generate-cards/`,
 * which operates at document scope rather than per-paragraph.
 */

import type { DocumentMeta } from '../txt-processor';
import type { GeneratedFlashcard } from '../anki-client';

export type { GeneratedFlashcard } from '../anki-client';
export type { DocumentMeta } from '../txt-processor';

export interface GenerateOptions {
  /** Deep-analysis mode: generate comprehensive coverage (3-6+ cards). */
  extraCards?: boolean;
  /** Output language for card content. */
  language?: 'he' | 'en';
  /** Optional abort signal for cancellation / timeouts. */
  signal?: AbortSignal;
}

export interface CardProvider {
  /** Stable identifier, e.g. "gemini" | "claude" | "mock". */
  readonly name: string;
  /**
   * Generate flashcards for a single paragraph. Implementations should return
   * raw cards; tag normalization is applied centrally via {@link applyMetaTags}.
   */
  generateFlashcards(
    paragraph: string,
    meta: DocumentMeta,
    opts?: GenerateOptions
  ): Promise<GeneratedFlashcard[]>;
}

/**
 * Apply document metadata tags to each generated card and normalize whitespace
 * in tags to underscores. Ported from the original src/gemini-client.ts so that
 * every provider produces identically-tagged output.
 */
export function applyMetaTags(
  cards: GeneratedFlashcard[],
  meta: DocumentMeta
): GeneratedFlashcard[] {
  return cards.map((card) => ({
    ...card,
    tags: [
      ...new Set([
        card.type,
        meta.thinker,
        meta.work,
        ...(meta.chapter ? [meta.chapter] : []),
        ...(card.tags || []),
      ]),
    ]
      .filter((tag): tag is string => typeof tag === 'string' && tag.length > 0)
      .map((tag) => tag.replace(/\s+/g, '_')),
  }));
}
