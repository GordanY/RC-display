import { describe, it, expect } from 'vitest';
import { parseMtlTextureRefs } from '../src/admin/mtlParse';

describe('parseMtlTextureRefs', () => {
  it('returns empty for empty input', () => {
    expect(parseMtlTextureRefs('')).toEqual([]);
  });

  it('extracts a single map_Kd reference', () => {
    const mtl = `newmtl m1\nmap_Kd horse.jpg\n`;
    expect(parseMtlTextureRefs(mtl)).toEqual([
      { material: 'm1', file: 'horse.jpg', hasSubpath: false },
    ]);
  });

  it('extracts multiple map_Kd references across newmtl blocks', () => {
    const mtl = `
# Blender 5.1.1 MTL File
newmtl tripo_mat_001
map_Kd S08_horse_basecolor.JPEG

newmtl tripo_mat_002
map_Kd S08_floor_basecolor.JPEG
`;
    expect(parseMtlTextureRefs(mtl)).toEqual([
      { material: 'tripo_mat_001', file: 'S08_horse_basecolor.JPEG', hasSubpath: false },
      { material: 'tripo_mat_002', file: 'S08_floor_basecolor.JPEG', hasSubpath: false },
    ]);
  });

  it('flags map_Kd values that contain a subdirectory', () => {
    const mtl = `newmtl m1\nmap_Kd textures/horse.jpg\n`;
    expect(parseMtlTextureRefs(mtl)).toEqual([
      { material: 'm1', file: 'textures/horse.jpg', hasSubpath: true },
    ]);
  });

  it('ignores map_Kd lines with no value', () => {
    const mtl = `newmtl m1\nmap_Kd\n`;
    expect(parseMtlTextureRefs(mtl)).toEqual([]);
  });

  it('handles map_Kd before any newmtl block (anonymous material)', () => {
    const mtl = `map_Kd orphan.jpg\n`;
    expect(parseMtlTextureRefs(mtl)).toEqual([
      { material: '', file: 'orphan.jpg', hasSubpath: false },
    ]);
  });
});
