/**
 * AnkiConnect Client
 * Adds cards to Anki via AnkiConnect API
 */

import { logger } from './logger';
import type { DocumentMeta } from './txt-processor';

const ANKI_CONNECT_URL = process.env.ANKI_CONNECT_URL || 'http://127.0.0.1:8765';
const MODEL_NAME = 'Academic Philosophy';

// ============== TYPES ==============

export interface GeneratedFlashcard {
  type: 'Concept' | 'Argument' | 'Context' | 'Contrast';
  front: string;
  back: string;
  context_logic: string;
  tags: string[];
}

export interface AnkiNote {
  deckName: string;
  modelName: string;
  fields: {
    Front: string;
    Back: string;
    Context_Logic: string;
    Source_Snippet: string;
    Thinker_Work: string;
  };
  tags: string[];
}

export interface AddNoteResult {
  success: boolean;
  noteId?: number;
  error?: string;
}

// ============== ANKI CONNECT ==============

async function invokeAnkiConnect<T>(action: string, params?: Record<string, unknown>): Promise<T> {
  const response = await fetch(ANKI_CONNECT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, version: 6, params })
  });
  
  if (!response.ok) {
    throw new Error(`AnkiConnect HTTP error: ${response.status}`);
  }
  
  const data = await response.json() as { error?: string; result?: T };
  if (data.error) {
    throw new Error(`AnkiConnect error: ${data.error}`);
  }
  
  return data.result as T;
}

/**
 * Check if Anki is running and AnkiConnect is available
 */
export async function checkAnkiConnection(): Promise<boolean> {
  try {
    const version = await invokeAnkiConnect<number>('version');
    logger.success(`Connected to AnkiConnect v${version}`);
    return true;
  } catch {
    logger.error('Failed to connect to AnkiConnect. Make sure Anki is running.');
    return false;
  }
}

/**
 * Get all deck names
 */
export async function getAllDecks(): Promise<string[]> {
  return await invokeAnkiConnect<string[]>('deckNames');
}

/**
 * Check if a deck exists
 */
export async function deckExists(deckName: string): Promise<boolean> {
  const decks = await getAllDecks();
  return decks.includes(deckName);
}

/**
 * Ensure the deck exists, create if not
 */
export async function ensureDeck(deckName: string): Promise<void> {
  await invokeAnkiConnect('createDeck', { deck: deckName });
  logger.info(`Deck "${deckName}" is ready`);
}

/**
 * Get subdeck name from document meta
 */
export function getSubdeckName(meta: DocumentMeta, parentDeck: string): string {
  const subdeckParts = [meta.thinker, meta.work];
  if (meta.chapter) {
    subdeckParts.push(meta.chapter);
  }
  const subdeckName = subdeckParts.join('-');
  return `${parentDeck}::${subdeckName}`;
}

/**
 * Check if the model exists
 */
export async function checkModel(): Promise<boolean> {
  const models = await invokeAnkiConnect<string[]>('modelNames');
  const exists = models.includes(MODEL_NAME);
  
  if (exists) {
    logger.success(`Model "${MODEL_NAME}" found`);
  } else {
    logger.error(`Model "${MODEL_NAME}" not found. Please create it in Anki first.`);
  }
  
  return exists;
}

/**
 * Convert a generated flashcard to Anki note format
 */
export function flashcardToNote(
  flashcard: GeneratedFlashcard,
  meta: DocumentMeta,
  parentDeck: string,
  sourceParagraph: string
): AnkiNote {
  // Format source with quotation marks and metadata in parentheses
  const sourceMetadata = meta.chapter 
    ? `(${meta.thinker}, ${meta.work}, ${meta.chapter})`
    : `(${meta.thinker}, ${meta.work})`;
  const formattedSource = `"${sourceParagraph}" ${sourceMetadata}`;
  
  // Create subdeck name: "פילוסופיה פוליטית::thinker-work-chapter"
  const fullDeckName = getSubdeckName(meta, parentDeck);
  
  return {
    deckName: fullDeckName,
    modelName: MODEL_NAME,
    fields: {
      Front: flashcard.front,
      Back: flashcard.back,
      Context_Logic: flashcard.context_logic,
      Source_Snippet: formattedSource,
      Thinker_Work: `${meta.thinker} - ${meta.work}${meta.chapter ? ` (${meta.chapter})` : ''}`
    },
    tags: flashcard.tags
  };
}

/**
 * Add a single note to Anki
 */
export async function addNote(note: AnkiNote): Promise<AddNoteResult> {
  try {
    const noteId = await invokeAnkiConnect<number>('addNote', {
      note: { ...note, options: { allowDuplicate: false, duplicateScope: 'deck' } }
    });
    return { success: true, noteId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('duplicate')) {
      logger.debug(`Skipped duplicate: ${note.fields.Front.substring(0, 50)}...`);
      return { success: true, error: 'duplicate' };
    }
    return { success: false, error: errorMsg };
  }
}

/**
 * Sync with AnkiWeb
 */
export async function syncWithAnkiWeb(): Promise<void> {
  try {
    await invokeAnkiConnect('sync');
    logger.success('Synced with AnkiWeb');
  } catch (error) {
    logger.warn(`Sync failed: ${error}`);
  }
}
