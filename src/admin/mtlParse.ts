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
