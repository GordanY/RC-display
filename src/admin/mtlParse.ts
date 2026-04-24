// Parses map_Kd lines so the admin UI can warn about missing/subdirectory textures.
export interface MtlTextureRef {
  material: string;
  file: string;
  hasSubpath: boolean;
}

export function parseMtlTextureRefs(mtlText: string): MtlTextureRef[] {
  const out: MtlTextureRef[] = [];
  let currentMaterial = '';
  for (const rawLine of mtlText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('#') || line.length === 0) continue;
    const newmtlMatch = line.match(/^newmtl\s+(.+)$/);
    if (newmtlMatch) {
      currentMaterial = newmtlMatch[1];
      continue;
    }
    const mapMatch = line.match(/^map_Kd\s+(.+)$/);
    if (mapMatch) {
      const file = mapMatch[1];
      if (!file) continue;
      out.push({
        material: currentMaterial,
        file,
        hasSubpath: file.includes('/'),
      });
    }
  }
  return out;
}

// Rewrites map_Kd values to bare basenames so obj2gltf finds textures uploaded
// flat into the artifact directory. Preserves any leading option flags
// (-clamp, -mm, -s …) by treating only the trailing whitespace-separated
// token as the filename. Returns the new text plus whether any change was
// made; callers use `changed` to decide whether to back up the original.
export function normalizeMtlText(text: string): { text: string; changed: boolean } {
  let changed = false;
  const next = text.replace(
    /^([ \t]*map_Kd\s+(?:.*\s)?)(\S+)([ \t]*)$/gim,
    (_full, prefix: string, file: string, trail: string) => {
      const base = file.includes('/') ? file.slice(file.lastIndexOf('/') + 1) : file;
      if (base !== file) changed = true;
      return prefix + base + trail;
    },
  );
  return { text: next, changed };
}
