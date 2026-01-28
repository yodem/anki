#!/usr/bin/env bun
/**
 * Process all text files and create Anki flashcards
 * 
 * Usage: bun run scripts/process.ts [deck-name]
 * 
 * Environment variables:
 *   DOCS_DIR - Directory with text files (default: ./docs)
 *   GEMINI_PROXY_URL - Gemini proxy URL (default: http://localhost:4000)
 *   PARENT_DECK - Anki deck name (default: פילוסופיה פוליטית)
 */

import { parseAllDocuments, flattenParagraphs, type ParsedDocument } from '../src/txt-processor';
import { generateFlashcards } from '../src/gemini-client';
import { 
  checkAnkiConnection, 
  ensureDeck, 
  checkModel, 
  flashcardToNote, 
  addNote,
  syncWithAnkiWeb,
  deckExists,
  getSubdeckName,
  type GeneratedFlashcard
} from '../src/anki-client';
import { logger } from '../src/logger';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';

// ============== CONFIG ==============

const DOCS_DIR = process.env.DOCS_DIR || join(import.meta.dir, '..', 'docs');
const GEMINI_PROXY_URL = process.env.GEMINI_PROXY_URL || 'http://localhost:4000';
const PARENT_DECK = process.argv[2] || process.env.PARENT_DECK || 'פילוסופיה פוליטית';
const CACHE_DIR = join(import.meta.dir, '..', '.cache');

// ============== MAIN ==============

async function main() {
  logger.banner();
  logger.info(`📂 Documents: ${DOCS_DIR}`);
  logger.info(`🎯 Parent Deck: ${PARENT_DECK}`);
  logger.info(`🤖 Proxy: ${GEMINI_PROXY_URL}`);
  
  // Check Anki connection
  logger.divider('Checking Anki');
  const ankiOk = await checkAnkiConnection();
  if (!ankiOk) {
    process.exit(1);
  }
  
  const modelOk = await checkModel();
  if (!modelOk) {
    process.exit(1);
  }
  
  await ensureDeck(PARENT_DECK);
  
  // Parse documents
  logger.divider('Parsing Documents');
  const allDocuments = await parseAllDocuments(DOCS_DIR);
  
  if (allDocuments.length === 0) {
    logger.error('No documents found!');
    process.exit(1);
  }
  
  // Filter out documents that have already been processed (deck exists)
  logger.divider('Checking Existing Decks');
  const documentsToProcess: ParsedDocument[] = [];
  const skippedDocuments: string[] = [];
  
  for (const doc of allDocuments) {
    const subdeckName = getSubdeckName(doc.meta, PARENT_DECK);
    const exists = await deckExists(subdeckName);
    
    if (exists) {
      skippedDocuments.push(`${doc.filename} (deck: ${subdeckName})`);
      logger.debug(`⏭️  Skipping ${doc.filename} - deck already exists`);
    } else {
      documentsToProcess.push(doc);
      logger.info(`✅ Will process ${doc.filename}`);
    }
  }
  
  if (skippedDocuments.length > 0) {
    logger.info(`Skipped ${skippedDocuments.length} already processed document(s)`);
  }
  
  if (documentsToProcess.length === 0) {
    logger.success('All documents have already been processed!');
    process.exit(0);
  }
  
  logger.info(`Processing ${documentsToProcess.length} new document(s)`);
  
  const paragraphs = flattenParagraphs(documentsToProcess);
  logger.info(`Total paragraphs to process: ${paragraphs.length}`);
  
  // Ensure cache directory exists
  await mkdir(CACHE_DIR, { recursive: true });
  
  // Process paragraphs
  logger.divider('Generating Flashcards');
  
  let totalGenerated = 0;
  let totalAdded = 0;
  const errors: string[] = [];
  
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]!;
    const extraCardsLabel = para.extraCards ? ' [EXTRA]' : '';
    logger.step(i + 1, paragraphs.length, `[${para.meta.thinker}] Paragraph ${para.paragraphIndex}/${para.totalParagraphs}${extraCardsLabel}`);
    
    try {
      // Generate flashcards via proxy
      const flashcards = await generateFlashcards(para.paragraph, para.meta, GEMINI_PROXY_URL, para.extraCards);
      
      if (flashcards.length === 0) {
        logger.debug(`No cards generated for paragraph ${para.paragraphIndex}`);
        continue;
      }
      
      totalGenerated += flashcards.length;
      logger.info(`  → Generated ${flashcards.length} cards`);
      
      // Cache the flashcards before adding to Anki
      const cacheFilename = `${para.filename.replace(/[^a-zA-Z0-9א-ת]/g, '_')}_para${para.paragraphIndex}_${Date.now()}.json`;
      const cachePath = join(CACHE_DIR, cacheFilename);
      await writeFile(cachePath, JSON.stringify({
        paragraph: para.paragraph,
        meta: para.meta,
        extraCards: para.extraCards,
        flashcards,
        timestamp: new Date().toISOString()
      }, null, 2));
      logger.debug(`  💾 Cached to ${cacheFilename}`);
      
      // Ensure deck exists before adding notes
      const fullDeckName = para.subDeck
        ? `${PARENT_DECK}::${para.subDeck}`
        : getSubdeckName(para.meta, PARENT_DECK);
      await ensureDeck(fullDeckName);

      // Add to Anki
      for (const card of flashcards) {
        const note = flashcardToNote(card, para.meta, PARENT_DECK, para.paragraph, para.subDeck);
        const result = await addNote(note);

        if (result.success) {
          totalAdded++;
        } else {
          errors.push(`${para.filename}#${para.paragraphIndex}: ${result.error}`);
        }
      }
      
      // Rate limiting - 1 second between paragraphs
      if (i < paragraphs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${para.filename}#${para.paragraphIndex}: ${msg}`);
      logger.error(`  ❌ ${msg}`);
    }
  }
  
  // Sync with AnkiWeb
  logger.divider('Syncing');
  await syncWithAnkiWeb();
  
  // Summary
  logger.divider('Done!');
  logger.success(`
📊 Summary:
   Documents Found: ${allDocuments.length}
   Documents Processed: ${documentsToProcess.length}
   Documents Skipped: ${skippedDocuments.length}
   Paragraphs: ${paragraphs.length}
   Flashcards Generated: ${totalGenerated}
   Flashcards Added: ${totalAdded}
   Errors: ${errors.length}
  `);
  
  if (skippedDocuments.length > 0) {
    logger.info('Skipped documents:');
    skippedDocuments.forEach(doc => logger.info(`  - ${doc}`));
  }
  
  if (errors.length > 0) {
    logger.warn('Errors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }
}

main().catch(console.error);
