#!/usr/bin/env bun
/**
 * Process all text files and create Anki flashcards.
 *
 * Usage:
 *   bun run scripts/process.ts [deck-name] [--provider <gemini|claude|mock>] [--dry-run]
 *
 * Environment variables:
 *   CARD_PROVIDER     - Provider to use (default: gemini). Overridden by --provider.
 *   DRY_RUN           - When truthy, skip all AnkiConnect writes. Overridden by --dry-run.
 *   DOCS_DIR          - Directory with text files (default: ./docs)
 *   PARENT_DECK       - Anki deck name (default: פילוסופיה פוליטית)
 *   GOOGLE_API_KEY    - Required for the gemini provider
 *   ANKI_CONNECT_URL  - AnkiConnect endpoint (default: http://127.0.0.1:8765)
 */

import { parseAllDocuments, flattenParagraphs, type ParsedDocument } from '../src/txt-processor';
import {
  checkAnkiConnection,
  ensureDeck,
  checkModel,
  flashcardToNote,
  addNote,
  syncWithAnkiWeb,
  deckExists,
  getSubdeckName,
} from '../src/anki-client';
import { loadConfig } from '../src/config';
import { parseCliArgs } from '../src/cli';
import { getProvider, applyMetaTags } from '../src/providers';
import { logger } from '../src/logger';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';

// ============== CONFIG ==============

const args = parseCliArgs();
const config = loadConfig({
  provider: args.provider,
  dryRun: args.dryRun,
  parentDeck: args.positionals[0],
});

const DOCS_DIR = config.docsDir || join(import.meta.dir, '..', 'docs');
const PARENT_DECK = config.parentDeck;
const CACHE_DIR = join(import.meta.dir, '..', '.cache');

// ============== MAIN ==============

async function main() {
  logger.banner();
  logger.info(`📂 Documents: ${DOCS_DIR}`);
  logger.info(`🎯 Parent Deck: ${PARENT_DECK}`);
  logger.info(`🤖 Provider: ${config.provider}${config.dryRun ? ' (DRY RUN — no Anki writes)' : ''}`);

  const provider = getProvider(config);

  // Check Anki connection (skipped in dry-run)
  if (!config.dryRun) {
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
  } else {
    logger.warn('Dry-run mode: skipping Anki connection, model, and deck checks');
  }

  // Parse documents
  logger.divider('Parsing Documents');
  const allDocuments = await parseAllDocuments(DOCS_DIR);

  if (allDocuments.length === 0) {
    logger.error('No documents found!');
    process.exit(1);
  }

  // Filter out documents that have already been processed (deck exists).
  // In dry-run there is no Anki to query, so process everything.
  logger.divider('Checking Existing Decks');
  const documentsToProcess: ParsedDocument[] = [];
  const skippedDocuments: string[] = [];

  for (const doc of allDocuments) {
    const subdeckName = getSubdeckName(doc.meta, PARENT_DECK);
    const exists = config.dryRun ? false : await deckExists(subdeckName);

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
      // Generate flashcards via the selected provider, then apply meta tags.
      const rawCards = await provider.generateFlashcards(para.paragraph, para.meta, {
        extraCards: para.extraCards,
        language: 'he',
      });
      const flashcards = applyMetaTags(rawCards, para.meta);

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
        provider: config.provider,
        flashcards,
        timestamp: new Date().toISOString(),
      }, null, 2));
      logger.debug(`  💾 Cached to ${cacheFilename}`);

      if (config.dryRun) {
        // Dry-run: cache only, do not write to Anki.
        totalAdded += 0;
        continue;
      }

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

  // Sync with AnkiWeb (skipped in dry-run)
  if (!config.dryRun) {
    logger.divider('Syncing');
    await syncWithAnkiWeb();
  }

  // Summary
  logger.divider('Done!');
  logger.success(`
📊 Summary:
   Provider: ${config.provider}${config.dryRun ? ' (dry-run)' : ''}
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
