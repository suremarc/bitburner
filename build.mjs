import { context } from 'esbuild';
import { WebSocketServer } from 'ws';
import { readFile, readdir } from 'fs/promises';
import { glob } from 'glob';
import { basename } from 'path';

const server = new WebSocketServer({
    port: 12525,
});

const SCRIPT_DIR = './dist';

/** @type {Plugin} */
let syncPlugin = {
    name: 'bitburnerSync',
    setup(build) {
        build.onEnd(async result => {
            for (const client of server.clients) {
                await Promise.all(await Promise.all((await glob(`${SCRIPT_DIR}/**/*.js`)).map(async path => {
                    client.send(JSON.stringify({
                        jsonrpc: "2.0",
                        method: "pushFile",
                        params: {
                            server: "home",
                            filename: basename(path),
                            content: await readFile(path, 'utf8')
                        }
                    }))
                })))
            }
        })
    }
}

const WATCH = process.argv.includes('--watch');

const ctx = await context({
    entryPoints: ['./src/main.ts', './src/hgw/hgw.ts'],
    outdir: SCRIPT_DIR,
    minify: !WATCH,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    loader: { '.css': 'text' },
    logLevel: 'info',
    plugins: [syncPlugin]
});

await ctx.rebuild();

if (WATCH) ctx.watch();
else ctx.dispose();