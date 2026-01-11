/**
 * Simple logger with colors and timestamps
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function formatMessage(level: string, emoji: string, color: string, message: string, data?: unknown): string {
  const ts = `${colors.dim}[${timestamp()}]${colors.reset}`;
  const lvl = `${color}${level}${colors.reset}`;
  const dataStr = data !== undefined ? `\n${colors.dim}${JSON.stringify(data, null, 2)}${colors.reset}` : '';
  return `${ts} ${emoji} ${lvl} ${message}${dataStr}`;
}

export const logger = {
  info(message: string, data?: unknown) {
    console.log(formatMessage('INFO', '📘', colors.blue, message, data));
  },
  
  success(message: string, data?: unknown) {
    console.log(formatMessage('SUCCESS', '✅', colors.green, message, data));
  },
  
  warn(message: string, data?: unknown) {
    console.log(formatMessage('WARN', '⚠️', colors.yellow, message, data));
  },
  
  error(message: string, data?: unknown) {
    console.error(formatMessage('ERROR', '❌', colors.red, message, data));
  },
  
  debug(message: string, data?: unknown) {
    if (process.env.DEBUG === 'true') {
      console.log(formatMessage('DEBUG', '🔍', colors.magenta, message, data));
    }
  },
  
  step(step: number, total: number, message: string) {
    const progress = `${colors.cyan}[${step}/${total}]${colors.reset}`;
    console.log(`${colors.dim}[${timestamp()}]${colors.reset} 📝 ${progress} ${message}`);
  },
  
  divider(title?: string) {
    const line = '─'.repeat(50);
    if (title) {
      console.log(`\n${colors.dim}${line}${colors.reset}`);
      console.log(`${colors.bright}${colors.cyan}  ${title}${colors.reset}`);
      console.log(`${colors.dim}${line}${colors.reset}\n`);
    } else {
      console.log(`${colors.dim}${line}${colors.reset}`);
    }
  },
  
  banner() {
    console.log(`
${colors.cyan}${colors.bright}
  ╔═══════════════════════════════════════════════╗
  ║                                               ║
  ║   📚 Political Philosophy Flashcard Generator ║
  ║              Powered by Gemini AI             ║
  ║                                               ║
  ╚═══════════════════════════════════════════════╝
${colors.reset}`);
  }
};

export default logger;

