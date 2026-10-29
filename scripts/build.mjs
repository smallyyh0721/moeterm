import { build } from 'esbuild';
import { build as viteBuild } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ssh2External = {
  name: 'ssh2-external',
  setup(build) {
    build.onResolve({ filter: /^ssh2(\/|$)/ }, (args) => ({ path: args.path, external: true }));
  },
};

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  external: ['electron'],
  plugins: [ssh2External],
  logLevel: 'info',
};

await build({
  ...common,
  entryPoints: [path.join(root, 'src/main/index.ts')],
  outfile: path.join(root, 'dist/main/index.js'),
});

await build({
  ...common,
  entryPoints: [path.join(root, 'src/preload/index.ts')],
  outfile: path.join(root, 'dist/preload/index.js'),
});

await viteBuild({
  configFile: path.join(root, 'vite.config.ts'),
});
