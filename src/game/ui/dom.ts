import renderApp from './app.pug?compiled';
import { ASSET_MANIFEST } from '../assets/manifest';
import { getAssetUrl } from '../assets/loader';

function buildAssetLocals() {
  const out: Record<string, string> = {};
  for (const id of Object.keys(ASSET_MANIFEST)) {
    out[id] = getAssetUrl(id) ?? '';
  }
  return out;
}

export function mountAppDom(root: HTMLElement): void {
  root.classList.add('app');
  root.innerHTML = renderApp({ assets: buildAssetLocals() });
}
