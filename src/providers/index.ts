/**
 * Provider factory.
 *
 * Resolves a {@link CardProvider} implementation from the active configuration.
 * This is the single seam the rest of the app depends on — scripts call
 * `getProvider(config)` and never import a concrete provider directly.
 */

import type { AppConfig, ProviderName } from '../config';
import type { CardProvider } from './types';
import { GeminiCardProvider } from './gemini';
import { ClaudeCardProvider } from './claude';
import { MockCardProvider } from './mock';

export type { CardProvider, GenerateOptions } from './types';
export { applyMetaTags } from './types';

export function getProvider(config: AppConfig): CardProvider {
  const name: ProviderName = config.provider;
  switch (name) {
    case 'gemini':
      return new GeminiCardProvider(config.gemini);
    case 'claude':
      return new ClaudeCardProvider(config.claude);
    case 'mock':
      return new MockCardProvider();
    default: {
      // Exhaustiveness guard.
      const _never: never = name;
      throw new Error(`Unhandled provider: ${String(_never)}`);
    }
  }
}
