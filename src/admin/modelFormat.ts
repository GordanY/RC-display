// Helpers for the OBJ ↔ FBX format toggle.
//
// `model` stores a relative path under public/artifacts/. The "active format"
// is inferred from its extension so existing creations (which store .glb from
// the server-side OBJ→GLB conversion) default to OBJ automatically. Switching
// is non-destructive: we only change which sibling file `model` points at,
// never delete anything.

export type ModelFormat = 'obj' | 'fbx';

export function detectFormat(modelPath: string): ModelFormat {
  return /\.fbx$/i.test(modelPath) ? 'fbx' : 'obj';
}

export function hasFormat(files: string[], format: ModelFormat): boolean {
  return format === 'fbx'
    ? files.some((f) => /\.fbx$/i.test(f))
    : files.some((f) => /\.(obj|glb)$/i.test(f));
}

// When switching to OBJ, prefer the .glb sibling (fast loader, same pref as
// uploadFile in api.ts) and fall back to .obj. When switching to FBX, just
// take the first .fbx. Returns the dir-relative basename, or undefined if
// nothing matches.
export function pickSibling(files: string[], format: ModelFormat): string | undefined {
  if (format === 'fbx') return files.find((f) => /\.fbx$/i.test(f));
  return files.find((f) => /\.glb$/i.test(f)) ?? files.find((f) => /\.obj$/i.test(f));
}

export function basename(path: string): string {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(i + 1) : path;
}

// True when `path` is set but its basename is absent from the directory
// listing — renders the "(檔案遺失)" marker so the admin sees when a file
// has been removed from disk out-of-band.
export function isMissing(path: string | undefined, files: string[]): boolean {
  if (!path) return false;
  return !files.includes(basename(path));
}

// Returns just the .jpg/.jpeg filenames from a directory listing, sorted
// for stable display order.
export function listJpegs(files: string[]): string[] {
  return files.filter((f) => /\.jpe?g$/i.test(f)).sort();
}

export function hasMtl(files: string[]): boolean {
  return files.some((f) => /\.mtl$/i.test(f));
}

export function hasObj(files: string[]): boolean {
  return files.some((f) => /\.obj$/i.test(f));
}
