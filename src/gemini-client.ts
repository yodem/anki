/**
 * Gemini Proxy Client
 * Sends paragraphs to the Gemini proxy and receives flashcards
 */

import { logger } from './logger';
import type { DocumentMeta } from './txt-processor';
import type { GeneratedFlashcard } from './anki-client';

const DEFAULT_PROXY_URL = 'http://localhost:4000';

/**
 * Generate flashcards from a paragraph using Gemini proxy
 */
export async function generateFlashcards(
  paragraph: string,
  meta: DocumentMeta,
  proxyUrl: string = DEFAULT_PROXY_URL,
  extraCards: boolean = false
): Promise<GeneratedFlashcard[]> {
  // Domain-based routing
  const domain = meta.domain || 'political';
  const endpoint = `/anki/philosophy/${domain}`;

  logger.debug(`Using endpoint: ${endpoint} for domain: ${domain}`);

  const response = await fetch(`${proxyUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paragraph,
      thinker: meta.thinker,
      work: meta.work,
      chapter: meta.chapter,
      language: 'he',
      extraCards
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Proxy error ${response.status}: ${errorText}`);
  }
  
  const data = await response.json() as {
    success: boolean;
    flashcards?: GeneratedFlashcard[] | GeneratedFlashcard;
    error?: string;
  };
  
  if (!data.success) {
    throw new Error(data.error || 'Proxy request failed');
  }
  
  if (!data.flashcards) {
    return [];
  }
  
  // Handle both array and single flashcard
  let flashcards = Array.isArray(data.flashcards) ? data.flashcards : [data.flashcards];
  
  // Add meta tags to each flashcard
  flashcards = flashcards.map(card => ({
    ...card,
    tags: [
      ...new Set([
        card.type,
        meta.thinker,
        meta.work,
        ...(meta.chapter ? [meta.chapter] : []),
        ...(card.tags || [])
      ])
    ].map(tag => tag.replace(/\s+/g, '_'))
  }));
  
  return flashcards;
}
