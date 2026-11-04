#!/usr/bin/env bun
/**
 * Retry processing specific paragraphs that failed
 * 
 * Usage: bun run scripts/retry-paragraphs.ts <filename> <paragraph-indices>
 * 
 * Example: bun run scripts/retry-paragraphs.ts "שיעור 4" 26 29
 * 
 * Environment variables:
 *   DOCS_DIR - Directory with text files (default: ./docs)
 *   GEMINI_PROXY_URL - Gemini proxy URL (default: http://localhost:4000)
 *   PARENT_DECK - Anki deck name (default: פילוסופיה פוליטית)
 */

import { parseTxtFile, type ParsedDocument } from '../src/txt-processor';
import {
  checkAnkiConnection,
  ensureDeck,
  checkModel,
  flashcardToNote,
  addNote,
  syncWithAnkiWeb,
  getSubdeckName,
} from '../src/anki-client';
import { loadConfig } from '../src/config';
import { parseCliArgs } from '../src/cli';
import { getProvider, applyMetaTags } from '../src/providers';
import { logger } from '../src/logger';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';

// ============== CONFIG ==============

const cliArgs = parseCliArgs();
const config = loadConfig({ provider: cliArgs.provider, dryRun: cliArgs.dryRun });
const provider = getProvider(config);

const DOCS_DIR = config.docsDir || join(import.meta.dir, '..', 'docs');
const PARENT_DECK = config.parentDeck;
const CACHE_DIR = join(import.meta.dir, '..', '.cache');
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

// ============== MAIN ==============

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) {
      throw error;
    }
    logger.warn(`  ⏳ Retrying in ${delay}ms... (${retries} attempts left)`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryWithBackoff(fn, retries - 1, delay * 1.5); // Exponential backoff
  }
}

async function main() {
  const args = cliArgs.positionals;

  if (args.length < 2) {
    logger.error('Usage: bun run scripts/retry-paragraphs.ts <filename> <paragraph-index1> [paragraph-index2] ... [--provider <name>] [--dry-run]');
    logger.error('Example: bun run scripts/retry-paragraphs.ts "שיעור 4" 26 29');
    process.exit(1);
  }

  const filename = args[0]!;
  const paragraphIndices = args.slice(1).map(arg => parseInt(arg, 10)).filter(n => !isNaN(n));
  
  if (paragraphIndices.length === 0) {
    logger.error('No valid paragraph indices provided');
    process.exit(1);
  }
  
  logger.banner();
  logger.info(`📂 Documents: ${DOCS_DIR}`);
  logger.info(`📄 File: ${filename}`);
  logger.info(`📋 Paragraphs to retry: ${paragraphIndices.join(', ')}`);
  logger.info(`🎯 Parent Deck: ${PARENT_DECK}`);
  logger.info(`🤖 Provider: ${config.provider}${config.dryRun ? ' (DRY RUN — no Anki writes)' : ''}`);

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
  
  // Parse the specific document
  logger.divider('Parsing Document');
  const filepath = join(DOCS_DIR, filename);
  
  let doc: ParsedDocument;
  try {
    doc = await parseTxtFile(filepath);
    logger.success(`Parsed ${doc.filename}`);
  } catch (error) {
    logger.error(`Failed to parse ${filepath}`, error);
    process.exit(1);
  }
  
  // Filter to only the paragraphs we want to retry
  const paragraphsToRetry = paragraphIndices
    .map(index => {
      if (index < 1 || index > doc.paragraphsWithExtra.length) {
        logger.warn(`⚠️  Paragraph ${index} is out of range (1-${doc.paragraphsWithExtra.length})`);
        return null;
      }
      const paraData = doc.paragraphsWithExtra[index - 1]!;
      return {
        paragraph: paraData.text,
        paragraphIndex: index,
        totalParagraphs: doc.paragraphsWithExtra.length,
        meta: doc.meta,
        filename: doc.filename,
        extraCards: paraData.extraCards
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
  
  if (paragraphsToRetry.length === 0) {
    logger.error('No valid paragraphs to retry');
    process.exit(1);
  }
  
  logger.info(`Processing ${paragraphsToRetry.length} paragraph(s)`);
  
  // Ensure cache directory exists
  await mkdir(CACHE_DIR, { recursive: true });
  
  // Process paragraphs
  logger.divider('Generating Flashcards');
  
  let totalGenerated = 0;
  let totalAdded = 0;
  const errors: string[] = [];
  
  for (let i = 0; i < paragraphsToRetry.length; i++) {
    const para = paragraphsToRetry[i]!;
    const extraCardsLabel = para.extraCards ? ' [EXTRA]' : '';
    logger.step(i + 1, paragraphsToRetry.length, `[${para.meta.thinker}] Paragraph ${para.paragraphIndex}/${para.totalParagraphs}${extraCardsLabel}`);
    
    try {
      // Generate flashcards via the selected provider, with retry logic.
      const flashcards = await retryWithBackoff(async () => {
        const rawCards = await provider.generateFlashcards(para.paragraph, para.meta, {
          extraCards: para.extraCards,
          language: 'he',
        });
        return applyMetaTags(rawCards, para.meta);
      });

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
        timestamp: new Date().toISOString()
      }, null, 2));
      logger.debug(`  💾 Cached to ${cacheFilename}`);

      if (config.dryRun) {
        // Dry-run: cache only, do not write to Anki.
        continue;
      }

      // Ensure deck exists before adding notes
      const fullDeckName = getSubdeckName(para.meta, PARENT_DECK);
      await ensureDeck(fullDeckName);
      
      // Add to Anki
      for (const card of flashcards) {
        const note = flashcardToNote(card, para.meta, PARENT_DECK, para.paragraph);
        const result = await addNote(note);
        
        if (result.success) {
          totalAdded++;
        } else {
          errors.push(`${para.filename}#${para.paragraphIndex}: ${result.error}`);
        }
      }
      
      // Rate limiting - 1 second between paragraphs
      if (i < paragraphsToRetry.length - 1) {
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
   Paragraphs Processed: ${paragraphsToRetry.length}
   Flashcards Generated: ${totalGenerated}
   Flashcards Added: ${totalAdded}
   Errors: ${errors.length}
  `);
  
  if (errors.length > 0) {
    logger.warn('Errors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }
}

main().catch(console.error);
