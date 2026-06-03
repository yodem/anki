/**
 * Gemini card provider.
 *
 * Implements CardProvider using the Google Generative AI SDK directly.
 * Ported from gemini-proxy/src/modules/anki/philosophy/{base,kant,political}/service.ts.
 *
 * Key design points:
 * - Stateful: per-`thinker|work` ChatSession is kept alive across paragraphs so
 *   Gemini has cross-paragraph context.
 * - History optimization: keeps only the first exchange (which carries the system
 *   instruction) + the most-recent exchange; intermediate turns are dropped.
 * - Domain routing: meta.domain === 'kant' → Kant context; anything else → Political.
 * - All state lives on the instance, so each GeminiCardProvider instance is isolated.
 */

import { GoogleGenerativeAI, type ChatSession } from '@google/generative-ai';
import type { CardProvider, GenerateOptions, GeneratedFlashcard, DocumentMeta } from '../types';
import type { GeminiConfig } from '../../config';
import { logger } from '../../logger';
import {
  getDomainContext,
  buildMessage,
  cleanResponseText,
} from './prompts';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type ChatContent = {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
};

type FlashcardType = 'Concept' | 'Argument' | 'Context' | 'Contrast';
const VALID_TYPES: FlashcardType[] = ['Concept', 'Argument', 'Context', 'Contrast'];

// ---------------------------------------------------------------------------
// GeminiCardProvider
// ---------------------------------------------------------------------------

export class GeminiCardProvider implements CardProvider {
  readonly name = 'gemini';

  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName: string;

  /** Active ChatSession objects keyed by `thinker|work`. */
  private readonly chatSessions = new Map<string, ChatSession>();
  /** Stored conversation history keyed by `thinker|work`. */
  private readonly chatHistory = new Map<string, ChatContent[]>();
  /** Keys that have already sent their first message (carrying system instruction). */
  private readonly conversationInitialized = new Set<string>();

  constructor(config: GeminiConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.modelName = config.model;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async generateFlashcards(
    paragraph: string,
    meta: DocumentMeta,
    opts: GenerateOptions = {}
  ): Promise<GeneratedFlashcard[]> {
    const language = opts.language ?? 'he';
    const extraCards = opts.extraCards ?? false;
    const conversationKey = `${meta.thinker}|${meta.work}`;

    logger.debug(`[GeminiCardProvider] generating for key=${conversationKey} extraCards=${extraCards}`);

    try {
      const isFirstMessage = !this.conversationInitialized.has(conversationKey);

      // Clear sessions for the same thinker on a different work before creating
      // a new session (work-switch cleanup).
      const chat = this.getOrCreateSession(conversationKey, meta.thinker, meta.work);

      const domainCtx = getDomainContext(meta.domain, language);
      const message = buildMessage(
        { paragraph, thinker: meta.thinker, work: meta.work, chapter: meta.chapter || undefined },
        domainCtx,
        extraCards,
        isFirstMessage,
        language
      );

      if (isFirstMessage) {
        this.conversationInitialized.add(conversationKey);
        logger.debug(`[GeminiCardProvider] first message for ${conversationKey} — system instruction prepended`);
      }

      const result = await chat.sendMessage(message);
      const text = result.response.text().trim();

      // Update conversation history: keep first exchange + latest exchange
      const currentHistory = this.chatHistory.get(conversationKey) ?? [];
      const newUser: ChatContent = { role: 'user', parts: [{ text: message }] };
      const newModel: ChatContent = { role: 'model', parts: [{ text }] };

      let updatedHistory: ChatContent[];
      if (currentHistory.length === 0) {
        updatedHistory = [newUser, newModel];
      } else {
        const firstExchange = currentHistory.slice(0, 2);
        updatedHistory = [...firstExchange, newUser, newModel];
      }
      this.chatHistory.set(conversationKey, updatedHistory);

      return this.parseResponse(text, meta);

    } catch (error) {
      logger.error(`[GeminiCardProvider] error generating flashcards for ${conversationKey}`, error);

      // Remove failed session so it can be recreated on next call
      this.chatSessions.delete(conversationKey);
      this.chatHistory.delete(conversationKey);
      this.conversationInitialized.delete(conversationKey);

      throw new Error('Failed to generate flashcards from content');
    }
  }

  // -------------------------------------------------------------------------
  // Session management
  // -------------------------------------------------------------------------

  private getOrCreateSession(
    conversationKey: string,
    thinker: string,
    work: string
  ): ChatSession {
    const existing = this.chatSessions.get(conversationKey);
    if (existing) {
      logger.debug(`[GeminiCardProvider] reusing ChatSession for ${conversationKey}`);
      return existing;
    }

    // Work-switch cleanup: clear sessions for this thinker on other works
    this.clearHistoryForThinkerOtherWorks(thinker, work);

    const storedHistory = this.chatHistory.get(conversationKey) ?? [];
    const model = this.genAI.getGenerativeModel({ model: this.modelName });
    const chat = model.startChat({ history: storedHistory });
    this.chatSessions.set(conversationKey, chat);
    this.conversationInitialized.delete(conversationKey);

    logger.debug(`[GeminiCardProvider] created new ChatSession for ${conversationKey}`);
    return chat;
  }

  private clearHistoryForThinkerOtherWorks(thinker: string, currentWork: string): void {
    for (const key of this.chatSessions.keys()) {
      if (key.startsWith(`${thinker}|`) && !key.endsWith(`|${currentWork}`)) {
        logger.debug(`[GeminiCardProvider] clearing old session for different work: ${key}`);
        this.chatSessions.delete(key);
        this.chatHistory.delete(key);
        this.conversationInitialized.delete(key);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Response parsing
  // -------------------------------------------------------------------------

  private parseResponse(responseText: string, meta: DocumentMeta): GeneratedFlashcard[] {
    const { thinker, work, chapter } = meta;

    try {
      const cleanText = cleanResponseText(responseText);
      const parsed: unknown = JSON.parse(cleanText);

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !('flashcards' in parsed) ||
        !Array.isArray((parsed as { flashcards: unknown }).flashcards)
      ) {
        throw new Error('Response does not contain flashcards array');
      }

      const rawCards: unknown[] = (parsed as { flashcards: unknown[] }).flashcards;

      const validCards: GeneratedFlashcard[] = rawCards
        .filter((card): card is { type: string; front: string; back: string } => {
          return (
            card !== null &&
            typeof card === 'object' &&
            'type' in card &&
            typeof (card as Record<string, unknown>).type === 'string' &&
            VALID_TYPES.includes((card as Record<string, unknown>).type as FlashcardType) &&
            'front' in card &&
            typeof (card as Record<string, unknown>).front === 'string' &&
            'back' in card &&
            typeof (card as Record<string, unknown>).back === 'string'
          );
        })
        .map((card) => {
          const c = card as Record<string, unknown>;
          const contextLogic =
            typeof c.context_logic === 'string' ? (c.context_logic as string).trim() : '';
          const tags: string[] = Array.isArray(c.tags)
            ? (c.tags as unknown[]).filter((t): t is string => typeof t === 'string')
            : [card.type, thinker, work, ...(chapter ? [chapter] : [])];

          return {
            type: card.type as FlashcardType,
            front: (card.front as string).trim(),
            back: (card.back as string).trim(),
            context_logic: contextLogic,
            tags,
          } satisfies GeneratedFlashcard;
        });

      if (validCards.length === 0) {
        logger.warn(`[GeminiCardProvider] no valid cards in response — using fallback`);
        return [this.fallbackCard(thinker, work, 'empty')];
      }

      return validCards;

    } catch (parseError) {
      logger.error(`[GeminiCardProvider] failed to parse response`, parseError);
      return [this.fallbackCard(thinker, work, 'parse-error')];
    }
  }

  private fallbackCard(
    thinker: string,
    work: string,
    reason: 'empty' | 'parse-error'
  ): GeneratedFlashcard {
    const back =
      reason === 'empty'
        ? 'לא ניתן היה לעבד את הפסקה. אנא נסה שוב או הזן פסקה ארוכה יותר.'
        : 'לא ניתן היה לעבד את התשובה מהמערכת. אנא נסה שוב.';
    const contextLogic =
      reason === 'empty'
        ? 'יש לוודא שהפסקה מכילה תוכן פילוסופי מספיק לניתוח.'
        : 'אירעה שגיאה בעיבוד התשובה.';

    return {
      type: 'Concept',
      front: `מהו הרעיון המרכזי בקטע זה של ${thinker}?`,
      back,
      context_logic: contextLogic,
      tags: ['Error', thinker, work],
    };
  }
}
