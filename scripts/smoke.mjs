import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronPath = require('electron');
const mode = process.argv.includes('--screenshot') ? '--screenshot' : '--smoke';

const child = spawn(String(electronPath), ['.', mode], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env },
});

const timer = setTimeout(() => {
  console.error(`SMOKE TIMEOUT (${mode})`);
  child.kill();
  process.exit(1);
}, 45000);

child.on('exit', (code) => {
  clearTimeout(timer);
  process.exit(code ?? 1);
});
