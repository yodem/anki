/**
 * Offline tests for the Gemini provider's prompt builders.
 *
 * The live Gemini API call needs GOOGLE_API_KEY (not available in CI here), but
 * the prompt-construction logic is pure string functions and IS testable offline.
 * These lock the three branches a port like this most easily breaks:
 *   1. domain routing (kant vs political must differ)
 *   2. system instruction present only on the first message of a conversation
 *   3. extra-cards deep mode vs standard mode
 */

import { test, expect, describe } from 'bun:test';
import { getDomainContext, buildSystemInstruction, buildMessage } from '../src/providers/gemini/prompts';

describe('getDomainContext — domain routing', () => {
  test("'kant' and 'political' produce distinct expertise", () => {
    const kant = getDomainContext('kant', 'he');
    const political = getDomainContext('political', 'he');
    expect(kant.expertise).not.toBe(political.expertise);
    expect(kant.expertise).toContain('קאנט');
  });

  test('kant context carries domain-specific additionalInstructions', () => {
    const kant = getDomainContext('kant', 'he');
    expect(kant.additionalInstructions).toBeDefined();
    expect(kant.additionalInstructions).toContain('אימפרטיב קטגורי');
  });

  test('undefined / unknown domain falls back to political', () => {
    expect(getDomainContext(undefined, 'he').expertise).toBe(getDomainContext('political', 'he').expertise);
    expect(getDomainContext('aristotle', 'he').expertise).toBe(getDomainContext('political', 'he').expertise);
  });
});

describe('buildMessage — system instruction placement', () => {
  const input = { paragraph: 'פסקה לבדיקה על מצב הטבע אצל הובס.', thinker: 'הובס', work: 'לויתן', chapter: 'יג' };
  const ctx = getDomainContext('political', 'he');

  test('first message embeds the system instruction', () => {
    const msg = buildMessage(input, ctx, false, /* isFirstMessage */ true, 'he');
    expect(msg).toContain('אתה מומחה'); // system-instruction opener
    expect(msg).toContain('"flashcards"'); // JSON-format block
  });

  test('subsequent messages omit the system instruction', () => {
    const msg = buildMessage(input, ctx, false, /* isFirstMessage */ false, 'he');
    expect(msg).not.toContain('אתה מומחה');
    expect(msg).toContain('הפסקה לניתוח'); // dynamic message body still present
  });
});

describe('buildMessage — extra-cards deep mode', () => {
  // Fixture paragraph deliberately avoids the words used as instruction markers.
  const input = { paragraph: 'הרצון הטוב הוא הטוב היחיד שאין בו סייג.', thinker: 'קאנט', work: 'הנחות יסוד', chapter: '' };
  const ctx = getDomainContext('kant', 'he');

  test('extraCards=true requests comprehensive 3-6 coverage', () => {
    const msg = buildMessage(input, ctx, /* extraCards */ true, false, 'he');
    expect(msg).toContain('ניתוח מעמיק');
    expect(msg).toContain('3-6');
  });

  test('extraCards=false requests the standard 1-2 cards', () => {
    const msg = buildMessage(input, ctx, /* extraCards */ false, false, 'he');
    expect(msg).not.toContain('ניתוח מעמיק');
    expect(msg).toContain('1-2 רעיונות');
  });
});

describe('buildSystemInstruction — language switch', () => {
  test('English mode produces English instructions', () => {
    const en = buildSystemInstruction(getDomainContext('political', 'en'), 'en');
    expect(en).toContain('You are an expert');
    expect(en).toContain('political philosophy');
  });
});
