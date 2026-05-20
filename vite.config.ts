import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import pug from 'pug';

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

export default defineConfig(({ mode }) => {
  // GitHub Pages serves the app under /<repo>/.
  // Build with `vite build --mode gh-pages` to enable it.
  const base = mode === 'gh-pages' ? '/palata/' : '/';

  return {
    base,
    plugins: [pugCompilePlugin()],
  };
});
