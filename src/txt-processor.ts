/**
 * TXT Processor
 * Parses txt files with the structure:
 * 
 * [Meta]
 * thinker: name
 * work: name
 * chapter: name
 * [Content]
 * paragraph
 * ---
 * paragraph
 */

import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { logger } from './logger';

export interface DocumentMeta {
  thinker: string;
  work: string;
  chapter: string;
}

export interface ParsedDocument {
  meta: DocumentMeta;
  paragraphs: string[];
  filename: string;
}

export interface ParagraphWithMeta {
  paragraph: string;
  paragraphIndex: number;
  totalParagraphs: number;
  meta: DocumentMeta;
  filename: string;
}

/**
 * Parse the raw text content from a txt file
 */
function parseDocumentContent(text: string, filename: string): ParsedDocument {
  logger.debug(`Parsing document content from: ${filename}`);
  
  // Normalize line endings
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split into meta and content sections
  const metaMatch = normalizedText.match(/\[Meta\]([\s\S]*?)\[Content\]/i);
  const contentMatch = normalizedText.match(/\[Content\]([\s\S]*)/i);
  
  if (!metaMatch || !contentMatch) {
    logger.error(`Invalid document structure in ${filename}. Expected [Meta] and [Content] sections.`);
    throw new Error(`Invalid document structure in ${filename}`);
  }
  
  const metaSection = metaMatch[1]!.trim();
  const contentSection = contentMatch[1]!.trim();
  
  // Parse meta section
  const meta: DocumentMeta = {
    thinker: '',
    work: '',
    chapter: ''
  };
  
  const metaLines = metaSection.split('\n');
  for (const line of metaLines) {
    const [key, ...valueParts] = line.split(':');
    const value = valueParts.join(':').trim();
    
    if (key!.toLowerCase().trim() === 'thinker') {
      meta.thinker = value;
    } else if (key!.toLowerCase().trim() === 'work') {
      meta.work = value;
    } else if (key!.toLowerCase().trim() === 'chapter') {
      meta.chapter = value;
    }
  }
  
  logger.debug(`Parsed meta`, meta);
  
  if (!meta.thinker || !meta.work) {
    logger.warn(`Missing required meta fields in ${filename}. Thinker: "${meta.thinker}", Work: "${meta.work}"`);
  }
  
  // Parse content section - split by separator (---)
  const paragraphs = contentSection
    .split(/\n---\n|\n-{3,}\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  logger.info(`Found ${paragraphs.length} paragraphs in ${filename}`);
  
  return {
    meta,
    paragraphs,
    filename
  };
}

/**
 * Parse a single txt file
 */
export async function parseTxtFile(filepath: string): Promise<ParsedDocument> {
  logger.debug(`Reading file: ${filepath}`);
  
  const text = await readFile(filepath, 'utf-8');
  const filename = filepath.split('/').pop() || filepath;
  
  return parseDocumentContent(text, filename);
}

/**
 * Get all text files from a directory (with or without .txt extension)
 * Filters out README.md and other non-content files
 */
export async function getTxtFiles(dirPath: string): Promise<string[]> {
  try {
    const files = await readdir(dirPath);
    const txtFiles = files.filter(file => {
      // Include .txt files or files without extension
      // Exclude README.md and hidden files
      const hasNoExtension = !file.includes('.');
      const hasTxtExtension = file.endsWith('.txt');
      const isNotReadme = !file.toLowerCase().includes('readme');
      
      return (hasNoExtension || hasTxtExtension) && isNotReadme;
    });
    logger.info(`Found ${txtFiles.length} text files in ${dirPath}`);
    return txtFiles.map(file => join(dirPath, file));
  } catch (error) {
    logger.error(`Failed to read directory: ${dirPath}`, error);
    throw error;
  }
}

/**
 * Parse all documents in a directory
 */
export async function parseAllDocuments(dirPath: string): Promise<ParsedDocument[]> {
  logger.info(`Scanning directory: ${dirPath}`);
  
  const files = await getTxtFiles(dirPath);
  
  if (files.length === 0) {
    logger.warn('No text files found');
    return [];
  }
  
  const documents: ParsedDocument[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    logger.step(i + 1, files.length, `Parsing: ${file.split('/').pop()}`);
    
    try {
      const doc = await parseTxtFile(file);
      documents.push(doc);
    } catch (error) {
      logger.error(`Failed to parse ${file}`, error);
    }
  }
  
  logger.success(`Parsed ${documents.length}/${files.length} documents`);
  return documents;
}

/**
 * Flatten all paragraphs from multiple documents into a single array
 * with their associated metadata
 */
export function flattenParagraphs(documents: ParsedDocument[]): ParagraphWithMeta[] {
  const allParagraphs: ParagraphWithMeta[] = [];
  
  for (const doc of documents) {
    for (let i = 0; i < doc.paragraphs.length; i++) {
      allParagraphs.push({
        paragraph: doc.paragraphs[i]!,
        paragraphIndex: i + 1,
        totalParagraphs: doc.paragraphs.length,
        meta: doc.meta,
        filename: doc.filename
      });
    }
  }
  
  return allParagraphs;
}

