#!/usr/bin/env bun
/**
 * Move cards from parent deck to subdeck
 */

const ANKI_CONNECT_URL = process.env.ANKI_CONNECT_URL || 'http://127.0.0.1:8765';

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

async function main() {
  const sourceDeck = 'פילוסופיה פוליטית';
  const targetDeck = 'פילוסופיה פוליטית::אריסטו-פוליטיקה-ספר א';
  
  console.log(`Moving cards from "${sourceDeck}" to "${targetDeck}"...\n`);
  
  // Ensure target deck exists
  await invokeAnkiConnect('createDeck', { deck: targetDeck });
  console.log(`✅ Created/verified deck: ${targetDeck}`);
  
  // Find all cards in source deck
  const noteIds = await invokeAnkiConnect<number[]>('findNotes', { 
    query: `deck:"${sourceDeck}"` 
  });
  
  console.log(`Found ${noteIds.length} notes in "${sourceDeck}"`);
  
  if (noteIds.length === 0) {
    console.log('No notes to move.');
    return;
  }
  
  // Get all card IDs in the source deck
  const cardIds = await invokeAnkiConnect<number[]>('findCards', { 
    query: `deck:"${sourceDeck}"` 
  });
  
  console.log(`Found ${cardIds.length} cards to move`);
  
  if (cardIds.length === 0) {
    console.log('No cards to move.');
    return;
  }
  
  // Move all cards to the new deck in one batch
  try {
    await invokeAnkiConnect('changeDeck', {
      cards: cardIds,
      deck: targetDeck
    });
    console.log(`\n✅ Successfully moved ${cardIds.length} cards to "${targetDeck}"`);
  } catch (error) {
    console.error(`\n❌ Error moving cards:`, error);
    throw error;
  }
}

main().catch(console.error);
