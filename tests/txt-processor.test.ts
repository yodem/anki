/**
 * Tests for src/txt-processor.ts
 *
 * Uses inline string fixtures written to a temp dir so the tests have no
 * dependency on the real docs/ directory.
 *
 * Key invariant from the parser: text before the FIRST separator is ignored —
 * only content that follows a --- or ---+ line is captured.  Every fixture
 * below therefore places a separator before each paragraph.
 */

import { test, expect, afterAll } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseTxtFile } from '../src/txt-processor';

// ── helpers ──────────────────────────────────────────────────────────────────

let tmpDirs: string[] = [];

async function makeTmpFile(content: string, name = 'fixture.txt'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'anki-test-'));
  tmpDirs.push(dir);
  const path = join(dir, name);
  await writeFile(path, content, 'utf-8');
  return path;
}

afterAll(async () => {
  for (const d of tmpDirs) {
    await rm(d, { recursive: true, force: true });
  }
});

// ── meta field parsing ────────────────────────────────────────────────────────

test('parses thinker, work, chapter meta fields', async () => {
  const content = `[Meta]
thinker: אריסטו
work: פוליטיקה
chapter: ספר א

[Content]
---
First paragraph text.
`;
  const path = await makeTmpFile(content);
  const doc = await parseTxtFile(path);

  expect(doc.meta.thinker).toBe('אריסטו');
  expect(doc.meta.work).toBe('פוליטיקה');
  expect(doc.meta.chapter).toBe('ספר א');
});

test('parses explicit domain meta field', async () => {
  const content = `[Meta]
thinker: Hobbes
work: Leviathan
chapter: Part I
domain: british

[Content]
---
Some paragraph.
`;
  const path = await makeTmpFile(content);
  const doc = await parseTxtFile(path);

  expect(doc.meta.domain).toBe('british');
});

// ── domain inference ──────────────────────────────────────────────────────────

test('infers domain "kant" for thinker קאנט', async () => {
  const content = `[Meta]
thinker: קאנט
work: ביקורת התבונה הטהורה

[Content]
---
A paragraph from Kant.
`;
  const path = await makeTmpFile(content);
  const doc = await parseTxtFile(path);

  expect(doc.meta.domain).toBe('kant');
});

test('infers domain "kant" for English thinker name Kant', async () => {
  const content = `[Meta]
thinker: Kant
work: Critique of Pure Reason

[Content]
---
A paragraph from Kant in English.
`;
  const path = await makeTmpFile(content);
  const doc = await parseTxtFile(path);

  expect(doc.meta.domain).toBe('kant');
});

test('defaults domain to "political" for other thinkers', async () => {
  const content = `[Meta]
thinker: Rawls
work: A Theory of Justice

[Content]
---
A Rawls paragraph.
`;
  const path = await makeTmpFile(content);
  const doc = await parseTxtFile(path);

  expect(doc.meta.domain).toBe('political');
});

// ── paragraph splitting on --- ────────────────────────────────────────────────

test('splits content into paragraphs on --- separators', async () => {
  const content = `[Meta]
thinker: Rousseau
work: The Social Contract

[Content]
---
First paragraph.
---
Second paragraph.
---
Third paragraph.
`;
  const path = await makeTmpFile(content);
  const doc = await parseTxtFile(path);

  expect(doc.paragraphs.length).toBe(3);
  expect(doc.paragraphs[0]).toBe('First paragraph.');
  expect(doc.paragraphs[1]).toBe('Second paragraph.');
  expect(doc.paragraphs[2]).toBe('Third paragraph.');
});

test('all paragraphs split on plain --- have extraCards=false', async () => {
  const content = `[Meta]
thinker: Locke
work: Two Treatises

[Content]
---
Para A.
---
Para B.
`;
  const path = await makeTmpFile(content);
  const doc = await parseTxtFile(path);

  expect(doc.paragraphsWithExtra.every(p => p.extraCards === false)).toBe(true);
});

// ── deep-mode flag on ---+ ────────────────────────────────────────────────────

test('sets extraCards=true on paragraphs preceded by ---+', async () => {
  const content = `[Meta]
thinker: קאנט
work: ביקורת התבונה המעשית

[Content]
---
Normal paragraph.
---+
Deep paragraph.
`;
  const path = await makeTmpFile(content);
  const doc = await parseTxtFile(path);

  expect(doc.paragraphsWithExtra.length).toBe(2);
  expect(doc.paragraphsWithExtra[0]!.extraCards).toBe(false);
  expect(doc.paragraphsWithExtra[1]!.extraCards).toBe(true);
  expect(doc.paragraphsWithExtra[1]!.text).toBe('Deep paragraph.');
});

test('handles file where every paragraph is deep mode', async () => {
  const content = `[Meta]
thinker: Hegel
work: Phenomenology of Spirit

[Content]
---+
Spirit is substance.
---+
And substance is spirit.
`;
  const path = await makeTmpFile(content);
  const doc = await parseTxtFile(path);

  expect(doc.paragraphsWithExtra.length).toBe(2);
  expect(doc.paragraphsWithExtra.every(p => p.extraCards === true)).toBe(true);
});

// ── [[SUB_DECK - X]] extraction ───────────────────────────────────────────────

test('extracts SUB_DECK annotation and strips it from paragraph text', async () => {
  const content = `[Meta]
thinker: אריסטו
work: פוליטיקה

[Content]
---
[[SUB_DECK - Ethics]]
The good life is the highest aim.
`;
  const path = await makeTmpFile(content);
  const doc = await parseTxtFile(path);

  expect(doc.paragraphsWithExtra.length).toBe(1);
  expect(doc.paragraphsWithExtra[0]!.subDeck).toBe('Ethics');
  // The [[SUB_DECK - ...]] line itself must NOT appear in the paragraph text
  expect(doc.paragraphsWithExtra[0]!.text).not.toContain('SUB_DECK');
  expect(doc.paragraphsWithExtra[0]!.text).toContain('The good life');
});

test('paragraphs without SUB_DECK annotation have subDeck=undefined', async () => {
  const content = `[Meta]
thinker: Mill
work: On Liberty

[Content]
---
Liberty means absence of coercion.
`;
  const path = await makeTmpFile(content);
  const doc = await parseTxtFile(path);

  expect(doc.paragraphsWithExtra[0]!.subDeck).toBeUndefined();
});

// ── structural validation ─────────────────────────────────────────────────────

test('throws on missing [Meta] section', async () => {
  const content = `[Content]
---
Some content.
`;
  const path = await makeTmpFile(content);

  await expect(parseTxtFile(path)).rejects.toThrow();
});

test('throws on missing [Content] section', async () => {
  const content = `[Meta]
thinker: Kant
work: Critique
`;
  const path = await makeTmpFile(content);

  await expect(parseTxtFile(path)).rejects.toThrow();
});

// ── filename captured ─────────────────────────────────────────────────────────

test('captures filename in parsed document', async () => {
  const content = `[Meta]
thinker: Plato
work: Republic

[Content]
---
Justice is the cardinal virtue.
`;
  const path = await makeTmpFile(content, 'my-reading.txt');
  const doc = await parseTxtFile(path);

  expect(doc.filename).toBe('my-reading.txt');
});
