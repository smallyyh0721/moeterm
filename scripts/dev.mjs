import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { context } from 'esbuild';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronPath = require('electron');

const ssh2External = {
  name: 'ssh2-external',
  setup(build) {
    build.onResolve({ filter: /^ssh2(\/|$)/ }, (args) => ({ path: args.path, external: true }));
  },
};

const mainCtx = await context({
  entryPoints: [path.join(root, 'src/main/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.join(root, 'dist/main/index.js'),
  external: ['electron'],
  plugins: [ssh2External],
  sourcemap: true,
});
const preloadCtx = await context({
  entryPoints: [path.join(root, 'src/preload/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.join(root, 'dist/preload/index.js'),
  external: ['electron'],
  sourcemap: true,
});
await mainCtx.rebuild();
await preloadCtx.rebuild();
await mainCtx.watch();
await preloadCtx.watch();

const server = await createServer({
  configFile: path.join(root, 'vite.config.ts'),
});
await server.listen();
const url = server.resolvedUrls?.local?.[0];
if (!url) {
  throw new Error('Vite 没有给出本地地址');
}

const child = spawn(String(electronPath), ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, MOETERM_DEV_SERVER: url },
});

async function shutdown(code) {
  await server.close();
  await mainCtx.dispose();
  await preloadCtx.dispose();
  process.exit(code ?? 0);
}

child.on('exit', (code) => {
  void shutdown(code ?? 0);
});
process.on('SIGINT', () => {
  child.kill();
});
