// Parses an MTL file's text into an ordered list of texture references.
// Used by the admin UI to (a) show which materials still need a JPEG, and
// (b) warn when an MTL uses a subdirectory path (which the flat upload UI
// can't satisfy).
export interface MtlTextureRef {
  material: string;     // newmtl name preceding this map_Kd; '' if none
  file: string;         // raw value of the map_Kd line, trimmed
  hasSubpath: boolean;  // true if `file` contains a forward slash
}

export function parseMtlTextureRefs(mtlText: string): MtlTextureRef[] {
  const out: MtlTextureRef[] = [];
  let currentMaterial = '';
  for (const rawLine of mtlText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('#') || line.length === 0) continue;
    const newmtlMatch = line.match(/^newmtl\s+(.+)$/);
    if (newmtlMatch) {
      currentMaterial = newmtlMatch[1].trim();
      continue;
    }
    const mapMatch = line.match(/^map_Kd\s+(.+)$/);
    if (mapMatch) {
      const file = mapMatch[1].trim();
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
