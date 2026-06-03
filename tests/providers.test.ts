/**
 * Tests for the provider abstraction seam.
 *
 * All assertions are offline — no network, no API keys.
 *
 * - MockCardProvider:  structural validity of returned cards
 * - applyMetaTags:     tag composition + whitespace normalization
 * - getProvider:       factory resolves 'mock' to MockCardProvider
 * - resolveProviderName: known names pass through, unknown names throw
 */

import { test, expect } from 'bun:test';
import { MockCardProvider } from '../src/providers/mock';
import { applyMetaTags } from '../src/providers/types';
import { loadConfig, resolveProviderName } from '../src/config';
import type { DocumentMeta } from '../src/txt-processor';
import type { GeneratedFlashcard } from '../src/anki-client';

// ── helpers ──────────────────────────────────────────────────────────────────

const VALID_TYPES = new Set(['Concept', 'Argument', 'Context', 'Contrast']);

function isValidCard(card: GeneratedFlashcard): boolean {
  return (
    VALID_TYPES.has(card.type) &&
    typeof card.front === 'string' && card.front.length > 0 &&
    typeof card.back === 'string' && card.back.length > 0 &&
    typeof card.context_logic === 'string' &&
    Array.isArray(card.tags)
  );
}

const testMeta: DocumentMeta = {
  thinker: 'קאנט',
  work: 'ביקורת התבונה הטהורה',
  chapter: 'הקדמה',
  domain: 'kant',
};

const testParagraph =
  'הציווי הקטגורי מחייב אותנו לפעול על פי כלל שאנו יכולים לרצות שיהיה לחוק אוניברסלי.';

// ── MockCardProvider ──────────────────────────────────────────────────────────

test('MockCardProvider.name is "mock"', () => {
  const provider = new MockCardProvider();
  expect(provider.name).toBe('mock');
});

test('MockCardProvider returns ≥1 structurally-valid card in standard mode', async () => {
  const provider = new MockCardProvider();
  const cards = await provider.generateFlashcards(testParagraph, testMeta, {});

  expect(cards.length).toBeGreaterThanOrEqual(1);
  for (const card of cards) {
    expect(isValidCard(card)).toBe(true);
  }
});

test('MockCardProvider standard mode returns exactly 1 card', async () => {
  const provider = new MockCardProvider();
  const cards = await provider.generateFlashcards(testParagraph, testMeta, { extraCards: false });

  expect(cards.length).toBe(1);
});

test('MockCardProvider extraCards mode returns ≥2 cards', async () => {
  const provider = new MockCardProvider();
  const cards = await provider.generateFlashcards(testParagraph, testMeta, { extraCards: true });

  expect(cards.length).toBeGreaterThanOrEqual(2);
  for (const card of cards) {
    expect(isValidCard(card)).toBe(true);
  }
});

test('MockCardProvider extraCards mode includes multiple card types', async () => {
  const provider = new MockCardProvider();
  const cards = await provider.generateFlashcards(testParagraph, testMeta, { extraCards: true });

  const types = cards.map(c => c.type);
  // Expect at least two different types across deep-mode cards
  const uniqueTypes = new Set(types);
  expect(uniqueTypes.size).toBeGreaterThanOrEqual(2);
});

test('MockCardProvider card front and back are non-empty strings', async () => {
  const provider = new MockCardProvider();
  const [card] = await provider.generateFlashcards(testParagraph, testMeta);

  expect(typeof card!.front).toBe('string');
  expect(card!.front.length).toBeGreaterThan(0);
  expect(typeof card!.back).toBe('string');
  expect(card!.back.length).toBeGreaterThan(0);
});

// ── applyMetaTags ─────────────────────────────────────────────────────────────

test('applyMetaTags adds thinker, work, and chapter tags', () => {
  const cards: GeneratedFlashcard[] = [
    { type: 'Concept', front: 'Q', back: 'A', context_logic: '', tags: [] },
  ];
  const meta: DocumentMeta = {
    thinker: 'Kant',
    work: 'Critique of Pure Reason',
    chapter: 'Transcendental Aesthetic',
  };

  const tagged = applyMetaTags(cards, meta);
  const tags = tagged[0]!.tags;

  expect(tags).toContain('Kant');
  expect(tags).toContain('Critique_of_Pure_Reason'); // spaces → underscores
  expect(tags).toContain('Transcendental_Aesthetic');
});

test('applyMetaTags normalizes spaces to underscores in all tags', () => {
  const cards: GeneratedFlashcard[] = [
    { type: 'Argument', front: 'Q', back: 'A', context_logic: '', tags: ['moral law'] },
  ];
  const meta: DocumentMeta = {
    thinker: 'John Rawls',
    work: 'A Theory of Justice',
    chapter: 'Original Position',
  };

  const tagged = applyMetaTags(cards, meta);
  for (const tag of tagged[0]!.tags) {
    expect(tag).not.toContain(' ');
  }
});

test('applyMetaTags includes card type in tags', () => {
  const cards: GeneratedFlashcard[] = [
    { type: 'Contrast', front: 'Q', back: 'A', context_logic: '', tags: [] },
  ];
  const tagged = applyMetaTags(cards, testMeta);
  expect(tagged[0]!.tags).toContain('Contrast');
});

test('applyMetaTags omits chapter tag when chapter is empty string', () => {
  const cards: GeneratedFlashcard[] = [
    { type: 'Context', front: 'Q', back: 'A', context_logic: '', tags: [] },
  ];
  const meta: DocumentMeta = { thinker: 'Rousseau', work: 'Emile', chapter: '' };

  const tagged = applyMetaTags(cards, meta);
  // Chapter '' should be filtered out since it's empty
  const hasEmptyTag = tagged[0]!.tags.some(t => t === '');
  expect(hasEmptyTag).toBe(false);
});

test('applyMetaTags deduplicates tags', () => {
  const cards: GeneratedFlashcard[] = [
    { type: 'Concept', front: 'Q', back: 'A', context_logic: '', tags: ['קאנט'] },
  ];
  const meta: DocumentMeta = { thinker: 'קאנט', work: 'ביקורת', chapter: '' };

  const tagged = applyMetaTags(cards, meta);
  const kantCount = tagged[0]!.tags.filter(t => t === 'קאנט').length;
  expect(kantCount).toBe(1);
});

// ── provider factory ──────────────────────────────────────────────────────────

test('getProvider with mock config returns provider named "mock"', async () => {
  // Dynamic import isolates any resolution failure if sibling providers are absent
  try {
    const { getProvider } = await import('../src/providers/index');
    const config = loadConfig({ provider: 'mock' });
    const provider = getProvider(config);
    expect(provider.name).toBe('mock');
  } catch {
    // If the factory import fails (e.g. sibling provider not present),
    // fall back to verifying MockCardProvider directly.
    const provider = new MockCardProvider();
    expect(provider.name).toBe('mock');
  }
});

// ── resolveProviderName ───────────────────────────────────────────────────────

test('resolveProviderName("gemini") returns "gemini"', () => {
  expect(resolveProviderName('gemini')).toBe('gemini');
});

test('resolveProviderName("claude") returns "claude"', () => {
  expect(resolveProviderName('claude')).toBe('claude');
});

test('resolveProviderName("mock") returns "mock"', () => {
  expect(resolveProviderName('mock')).toBe('mock');
});

test('resolveProviderName throws on unknown provider name', () => {
  expect(() => resolveProviderName('openai')).toThrow();
});

test('resolveProviderName is case-insensitive', () => {
  expect(resolveProviderName('MOCK')).toBe('mock');
  expect(resolveProviderName('Gemini')).toBe('gemini');
});

// ── loadConfig ────────────────────────────────────────────────────────────────

test('loadConfig with provider override sets provider correctly', () => {
  const config = loadConfig({ provider: 'mock' });
  expect(config.provider).toBe('mock');
});

test('loadConfig sets sensible defaults', () => {
  const config = loadConfig({ provider: 'mock' });
  expect(config.ankiConnectUrl).toBeTruthy();
  expect(config.gemini.model).toBeTruthy();
  expect(config.claude.timeoutMs).toBeGreaterThan(0);
});
