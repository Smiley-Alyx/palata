import { defineConfig, type Plugin } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import pug from 'pug';

const LEVEL_SAVE_ROUTE = '/__palata/level-editor/save';

// Precompile *.pug?compiled imports into a tiny ES module that exports a
// `render(locals)` function. Pug's full parser stays out of the bundle —
// only the small `pug-runtime` helper module is shipped.
function pugCompilePlugin(): Plugin {
  const SUFFIX = '?compiled';
  return {
    name: 'pug-compile-client',
    enforce: 'pre',
    transform(_code, id) {
      if (!id.includes('.pug')) return null;
      if (!id.endsWith(`.pug${SUFFIX}`)) return null;
      const filename = id.slice(0, -SUFFIX.length);
      const source = readFileSync(filename, 'utf8');
      const result = pug.compileClientWithDependenciesTracked(source, {
        filename,
        name: 'pugRender',
        compileDebug: false,
      });
      for (const dep of result.dependencies) {
        this.addWatchFile(dep);
      }
      const code = `${result.body}\nexport default pugRender;\n`;
      return { code, map: null };
    },
  };
}

function levelEditorSavePlugin(): Plugin {
  const root = process.cwd();
  const levelsRoot = resolve(root, 'public/assets/data/levels');

  function resolveLevelPath(levelPath: unknown) {
    if (typeof levelPath !== 'string') return null;
    const normalized = levelPath.trim().replace(/^\/+/, '');
    if (!normalized.endsWith('.json')) return null;

    const relativePath = normalized.startsWith('assets/data/levels/')
      ? normalized.slice('assets/data/levels/'.length)
      : normalized;
    const outPath = resolve(levelsRoot, relativePath);
    const rel = relative(levelsRoot, outPath);
    if (rel.startsWith('..') || resolve(levelsRoot, rel) !== outPath) return null;
    return outPath;
  }

  return {
    name: 'palata-level-editor-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(LEVEL_SAVE_ROUTE, (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body) as { path?: unknown; json?: unknown };
            const outPath = resolveLevelPath(payload.path);
            if (!outPath || typeof payload.json !== 'string') {
              res.statusCode = 400;
              res.end('Invalid level payload');
              return;
            }

            const level = JSON.parse(payload.json);
            const json = `${JSON.stringify(level, null, 2)}\n`;
            mkdirSync(dirname(outPath), { recursive: true });
            writeFileSync(outPath, json, 'utf8');
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: true, path: relative(root, outPath) }));
          } catch (err) {
            res.statusCode = 400;
            res.end(err instanceof Error ? err.message : 'Failed to save level');
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // GitHub Pages serves the app under /<repo>/.
  // Build with `vite build --mode gh-pages` to enable it.
  const base = mode === 'gh-pages' ? '/palata/' : '/';
  const levelEditorEnabled = mode !== 'gh-pages';

  return {
    base,
    define: {
      __LEVEL_EDITOR_ENABLED__: JSON.stringify(levelEditorEnabled),
    },
    plugins: [pugCompilePlugin(), levelEditorSavePlugin()],
  };
});
