/**
 * Central configuration for the Anki flashcard generator.
 *
 * All runtime knobs (which card provider to use, model names, API keys,
 * AnkiConnect URL, dry-run, etc.) are resolved here from environment
 * variables and CLI flags, so the rest of the codebase reads from one place.
 */

export type ProviderName = 'gemini' | 'claude' | 'mock';

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

export interface ClaudeConfig {
  /** Path to the `claude` CLI binary used for the subscription-backed path. */
  bin: string;
  /** Optional model override passed to `claude -p --model`. */
  model?: string;
  /** Per-request timeout in milliseconds for the headless CLI call. */
  timeoutMs: number;
}

export interface AppConfig {
  /** Active card-generation provider. */
  provider: ProviderName;
  /** Skip all AnkiConnect writes — generate + cache only. */
  dryRun: boolean;
  /** Default parent deck. */
  parentDeck: string;
  /** Directory holding the source text files. */
  docsDir: string;
  /** AnkiConnect endpoint. */
  ankiConnectUrl: string;
  gemini: GeminiConfig;
  claude: ClaudeConfig;
  /**
   * Legacy HTTP proxy URL. Only used by the deprecated `proxy` code path in
   * src/gemini-client.ts; the baked-in `gemini` provider does NOT use this.
   */
  legacyProxyUrl: string;
}

function envBool(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

/**
 * Resolve the provider name from an explicit value, then CARD_PROVIDER, then
 * a sensible default. Accepts a CLI-supplied override (e.g. `--provider claude`).
 */
export function resolveProviderName(override?: string): ProviderName {
  const raw = (override || process.env.CARD_PROVIDER || 'gemini').toLowerCase().trim();
  if (raw === 'gemini' || raw === 'claude' || raw === 'mock') return raw;
  throw new Error(
    `Unknown CARD_PROVIDER "${raw}". Valid values: gemini | claude | mock.`
  );
}

/**
 * Build the full application config. `overrides` lets callers (CLI scripts)
 * inject parsed flags without re-reading the environment.
 */
export function loadConfig(overrides: Partial<{ provider: string; dryRun: boolean; parentDeck: string }> = {}): AppConfig {
  return {
    provider: resolveProviderName(overrides.provider),
    dryRun: overrides.dryRun ?? envBool('DRY_RUN', false),
    parentDeck: overrides.parentDeck || process.env.PARENT_DECK || 'פילוסופיה פוליטית',
    docsDir: process.env.DOCS_DIR || '',
    ankiConnectUrl: process.env.ANKI_CONNECT_URL || 'http://127.0.0.1:8765',
    gemini: {
      // Accept either GOOGLE_API_KEY (proxy convention) or GEMINI_API_KEY.
      apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
    },
    claude: {
      bin: process.env.CLAUDE_BIN || 'claude',
      model: process.env.CLAUDE_MODEL || undefined,
      timeoutMs: Number(process.env.CLAUDE_TIMEOUT_MS || 180000),
    },
    legacyProxyUrl: process.env.GEMINI_PROXY_URL || 'http://localhost:4000',
  };
}
