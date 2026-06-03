#!/usr/bin/env bun
/**
 * Check Anki and AnkiConnect status
 */

console.log('Checking Anki connection...\n');

// Test standard AnkiConnect port
const ports = [8765, 3141];

for (const port of ports) {
  const url = `http://127.0.0.1:${port}`;
  console.log(`Testing port ${port}...`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ action: 'version', version: 6 })
    });
    
    if (response.ok) {
      const data = await response.json() as { result?: unknown };
      if (data.result) {
        console.log(`✅ AnkiConnect found on port ${port}!`);
        console.log(`   Version: ${data.result}`);
        console.log(`\nSet this environment variable:`);
        console.log(`   export ANKI_CONNECT_URL=http://127.0.0.1:${port}`);
        process.exit(0);
      }
    } else {
      console.log(`   ❌ Port ${port} responded but not AnkiConnect format`);
    }
  } catch (error) {
    console.log(`   ❌ Port ${port} not responding`);
  }
}

console.log('\n❌ Could not find AnkiConnect HTTP API.');
console.log('\nPlease install AnkiConnect addon in Anki:');
console.log('1. Open Anki');
console.log('2. Tools → Add-ons → Get Add-ons');
console.log('3. Enter code: 2055492159');
console.log('4. Restart Anki');
console.log('\nThe MCP server works, but the script needs AnkiConnect HTTP API.');

