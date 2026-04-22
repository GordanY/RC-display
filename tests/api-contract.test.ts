import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The Node dev server (server/index.ts) and the Flask production launcher
// (start.py) both expose the admin API. They must stay in sync — the "file
// missing" bug was `/api/list` existing only in Node, with Flask silently
// falling through to the SPA catch-all. This test asserts method+path parity
// so the next divergence fails CI instead of a demo.

function extractNodeRoutes(src: string): string[] {
  const out = new Set<string>();
  const re = /app\.(get|put|post|delete|patch)\(\s*['"]([^'"]+)['"]/g;
  for (const m of src.matchAll(re)) {
    if (m[2].startsWith('/api/')) out.add(`${m[1].toUpperCase()} ${m[2]}`);
  }
  return [...out].sort();
}

function extractFlaskRoutes(src: string): string[] {
  const out = new Set<string>();
  const re = /@app\.route\(\s*["']([^"']+)["'](?:\s*,\s*methods\s*=\s*\[([^\]]+)\])?/g;
  for (const m of src.matchAll(re)) {
    if (!m[1].startsWith('/api/')) continue;
    const methods = m[2]
      ? m[2].split(',').map((s) => s.replace(/['"\s]/g, '').toUpperCase()).filter(Boolean)
      : ['GET'];
    for (const method of methods) out.add(`${method} ${m[1]}`);
  }
  return [...out].sort();
}

describe('API contract parity', () => {
  it('server/index.ts and start.py expose the same /api routes', () => {
    const root = resolve(__dirname, '..');
    const node = readFileSync(resolve(root, 'server/index.ts'), 'utf-8');
    const flask = readFileSync(resolve(root, 'start.py'), 'utf-8');
    expect(extractFlaskRoutes(flask)).toEqual(extractNodeRoutes(node));
  });
});
