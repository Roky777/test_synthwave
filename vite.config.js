import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'vite';

const externalGameData = {
  name: 'external-game-data',
  async generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'src/data/game-data.json',
      source: await readFile(new URL('./src/data/game-data.json', import.meta.url)),
    });
  },
};

function encodeU32(value) {
  const bytes = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value) byte |= 0x80;
    bytes.push(byte);
  } while (value);
  return Buffer.from(bytes);
}

function customSection(name, data) {
  const encodedName = Buffer.from(name);
  const payload = Buffer.concat([encodeU32(encodedName.length), encodedName, data]);
  return Buffer.concat([Buffer.from([0]), encodeU32(payload.length), payload]);
}

async function createThemeAudioWasm() {
  const [echoes, cornfield] = await Promise.all([
    readFile(new URL('./src/assets/audio/echoes.mp3', import.meta.url)),
    readFile(new URL('./src/assets/audio/Cornfieldchase.mp3', import.meta.url)),
  ]);
  return Buffer.concat([
    Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
    customSection('echoes.mp3', echoes),
    customSection('Cornfieldchase.mp3', cornfield),
  ]);
}

const bundleThemeAudio = {
  name: 'bundle-theme-audio-wasm',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (!request.url?.split('?')[0].endsWith('/assets/theme-audio.wasm')) return next();
      createThemeAudioWasm()
        .then(wasm => {
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/wasm');
          response.end(wasm);
        })
        .catch(next);
    });
  },
  async closeBundle() {
    await writeFile(
      new URL('./dist/assets/theme-audio.wasm', import.meta.url),
      await createThemeAudioWasm(),
    );
  },
};

const extractInlineCss = {
  name: 'extract-inline-css',
  async closeBundle() {
    const htmlPath = new URL('./dist/index.html', import.meta.url);
    const cssPath = new URL('./dist/assets/index.css', import.meta.url);
    const html = await readFile(htmlPath, 'utf8');
    const style = html.match(/<style>([\s\S]*?)<\/style>/);
    if (!style) throw new Error('Expected an inline style block in the built index.html');

    // The style block's url()s were emitted relative to index.html at the dist root, but this CSS
    // is being moved into dist/assets/ — so './assets/x' would resolve to '/assets/assets/x'.
    // Re-base them to sit alongside the stylesheet.
    const css = style[1].replace(/url\((\s*['"]?)\.\/assets\//g, 'url($1./');
    if (/url\(\s*['"]?\.\/assets\//.test(css)) {
      throw new Error('extract-inline-css: failed to re-base asset URLs for dist/assets/index.css');
    }

    await writeFile(cssPath, css);
    await writeFile(
      htmlPath,
      html.replace(style[0], '<link rel="stylesheet" href="./assets/index.css">'),
    );
  },
};

export default defineConfig({
  base: './',
  plugins: [externalGameData, bundleThemeAudio, extractInlineCss],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    assetsInlineLimit: 0,
  },
});
