import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)\s[^'"`;]*?from\s*['"](\.\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.\/[^'"]+)['"]/g;

/** Every local module the entry file loads at startup, as the exact URLs (with ?v= query) the browser requests. */
export function collectModuleGraph(root, entry = 'app.js') {
  const found = new Map();
  const visit = (specifier) => {
    if (found.has(specifier)) return;
    found.set(specifier, true);
    const file = specifier.split('?')[0].replace(/^\.\//, '');
    const source = readFileSync(join(root, file), 'utf8');
    for (const match of source.matchAll(STATIC_IMPORT)) visit(match[1] ?? match[2]);
  };
  const entrySource = readFileSync(join(root, entry), 'utf8');
  for (const match of entrySource.matchAll(STATIC_IMPORT)) visit(match[1] ?? match[2]);
  return [...found.keys()].map((specifier) => specifier.replace(/^\.\//, ''));
}

export const FIREBASE_SDK_URLS = ['app', 'auth', 'firestore'].map((name) => `https://www.gstatic.com/firebasejs/12.19.0/firebase-${name}.js`);
