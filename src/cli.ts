/**
 * Minimal CLI flag parsing shared by the scripts.
 *
 * Supports:
 *   --provider <gemini|claude|mock>   (or --provider=<name>)
 *   --dry-run                          (skip all AnkiConnect writes)
 *
 * Everything else is returned as positional arguments, preserving order.
 */

export interface ParsedArgs {
  provider?: string;
  dryRun: boolean;
  positionals: string[];
}

export function parseCliArgs(argv: string[] = process.argv.slice(2)): ParsedArgs {
  const positionals: string[] = [];
  let provider: string | undefined;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--dry-run' || arg === '--dryRun') {
      dryRun = true;
    } else if (arg === '--provider') {
      provider = argv[++i];
    } else if (arg.startsWith('--provider=')) {
      provider = arg.slice('--provider='.length);
    } else {
      positionals.push(arg);
    }
  }

  return { provider, dryRun, positionals };
}
