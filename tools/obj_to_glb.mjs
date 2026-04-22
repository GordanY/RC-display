#!/usr/bin/env node
// @ts-nocheck — obj2gltf ships no types; this is a one-shot ops script, not app code.
// One-shot OBJ → GLB converter for RC-display artifacts.
//
// Walks public/artifacts/ recursively, converting every .obj file into a
// binary .glb sibling via obj2gltf. Leaves the original OBJ/MTL/JPEG intact
// (rollback: flip data.json back to .obj paths). Does NOT touch data.json —
// the operator decides per-artifact whether to switch the manifest after an
// eyeball fidelity check on the kiosk.
//
// Usage:
//   node tools/obj_to_glb.mjs                # convert files that have no .glb yet
//   node tools/obj_to_glb.mjs --force        # reconvert, overwriting existing .glb
//   node tools/obj_to_glb.mjs path/to/one.obj  # convert a single file

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import obj2gltf from 'obj2gltf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACTS_DIR = path.resolve(__dirname, '..', 'public', 'artifacts');

const args = process.argv.slice(2);
const force = args.includes('--force');
const explicitTargets = args.filter((a) => !a.startsWith('--'));

async function walkObj(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkObj(full)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.obj')) {
      out.push(full);
    }
  }
  return out;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function convertOne(objPath) {
  const glbPath = objPath.replace(/\.obj$/i, '.glb');
  const rel = path.relative(ARTIFACTS_DIR, objPath);

  if (!force) {
    try {
      await fs.access(glbPath);
      console.log(`SKIP  ${rel} (GLB exists; use --force to overwrite)`);
      return { skipped: true };
    } catch {
      // GLB missing, proceed.
    }
  }

  const inStat = await fs.stat(objPath);
  const t0 = performance.now();

  try {
    // obj2gltf defaults: embeds textures inline when binary=true, preserves
    // MTL materials as PBR metallic-roughness approximations. No DRACO.
    const glb = await obj2gltf(objPath, { binary: true });
    await fs.writeFile(glbPath, glb);
  } catch (err) {
    console.log(`FAIL  ${rel}: ${err.message}`);
    return { failed: true };
  }

  const outStat = await fs.stat(glbPath);
  const elapsed = (performance.now() - t0) / 1000;
  const ratio = ((outStat.size / inStat.size) * 100).toFixed(1);
  console.log(
    `OK    ${rel}: ${formatSize(inStat.size)} → ${formatSize(outStat.size)} ` +
      `(${ratio}%, ${elapsed.toFixed(1)}s)`,
  );
  return { in: inStat.size, out: outStat.size, elapsed };
}

async function main() {
  const targets = explicitTargets.length
    ? explicitTargets.map((t) => path.resolve(t))
    : await walkObj(ARTIFACTS_DIR);

  if (targets.length === 0) {
    console.log('No .obj files found under', ARTIFACTS_DIR);
    return;
  }

  console.log(`Converting ${targets.length} file(s) (force=${force})...\n`);

  const results = [];
  for (const obj of targets) {
    results.push(await convertOne(obj));
  }

  const ok = results.filter((r) => r && !r.skipped && !r.failed);
  const skipped = results.filter((r) => r?.skipped).length;
  const failed = results.filter((r) => r?.failed).length;
  const totalIn = ok.reduce((s, r) => s + r.in, 0);
  const totalOut = ok.reduce((s, r) => s + r.out, 0);

  console.log(
    `\n${ok.length} converted, ${skipped} skipped, ${failed} failed` +
      (ok.length ? `  —  ${formatSize(totalIn)} → ${formatSize(totalOut)} total` : ''),
  );
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
