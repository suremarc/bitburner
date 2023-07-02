import { context } from 'esbuild';

const WATCH = process.argv.includes('--watch');
const SCRIPT_NAME = 'main';

const ctx = await context({
    entryPoints: ['./src/index.ts'],
    outfile: `./dist/${SCRIPT_NAME}.js`,
    minify: !WATCH,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    loader: { '.css': 'text' },
    logLevel: 'info'
});

await ctx.rebuild();

if (WATCH) ctx.watch();
else ctx.dispose();