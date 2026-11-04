#!/usr/bin/env bun
/**
 * Test AnkiConnect connection
 */

const ANKI_CONNECT_URL = process.env.ANKI_CONNECT_URL || 'http://127.0.0.1:8765';

console.log(`Testing AnkiConnect at: ${ANKI_CONNECT_URL}\n`);

// Try common ports
const ports = [8765, 3141, 8080, 3000, 5000];

for (const port of ports) {
  const url = `http://127.0.0.1:${port}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'version', version: 6 })
    });
    
    if (response.ok) {
      const data = await response.json() as { result?: unknown };
      if (data.result) {
        console.log(`✅ Found AnkiConnect on port ${port}!`);
        console.log(`   Version: ${data.result}`);
        console.log(`\nSet this in your environment:`);
        console.log(`   export ANKI_CONNECT_URL=http://127.0.0.1:${port}`);
        process.exit(0);
      }
    }
  } catch (error) {
    // Port not responding, continue
  }
}

console.log('❌ Could not find AnkiConnect on any common port.');
console.log('\nPlease check:');
console.log('1. Is Anki running?');
console.log('2. Is AnkiConnect addon installed? (Tools → Add-ons)');
console.log('3. What port is AnkiConnect configured to use?');
console.log('\nYou can set a custom port with:');
console.log('   export ANKI_CONNECT_URL=http://127.0.0.1:YOUR_PORT');

