import { describe, it, expect } from 'vitest';
import { normalizeMtlText, parseMtlTextureRefs } from '../src/admin/mtlParse';

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

describe('normalizeMtlText', () => {
  it('returns unchanged for input with no map_Kd lines', () => {
    const input = `# comment\nnewmtl m1\nKd 1 1 1\n`;
    expect(normalizeMtlText(input)).toEqual({ text: input, changed: false });
  });

  it('returns unchanged when map_Kd already uses bare basenames', () => {
    const input = `newmtl m1\nmap_Kd horse.jpg\nnewmtl m2\nmap_Kd floor.JPEG\n`;
    expect(normalizeMtlText(input)).toEqual({ text: input, changed: false });
  });

  it('strips a single subdirectory prefix', () => {
    const input = `newmtl m1\nmap_Kd S08_horse/S08_horse_basecolor.JPEG\n`;
    const expected = `newmtl m1\nmap_Kd S08_horse_basecolor.JPEG\n`;
    expect(normalizeMtlText(input)).toEqual({ text: expected, changed: true });
  });

  it('strips nested subdirectory prefixes', () => {
    const input = `map_Kd a/b/c/file.jpg\n`;
    const expected = `map_Kd file.jpg\n`;
    expect(normalizeMtlText(input)).toEqual({ text: expected, changed: true });
  });

  it('preserves trailing options-style flags before the filename', () => {
    const input = `map_Kd -clamp on textures/file.jpg\n`;
    const expected = `map_Kd -clamp on file.jpg\n`;
    expect(normalizeMtlText(input)).toEqual({ text: expected, changed: true });
  });

  it('handles the user-reported two-material case', () => {
    const input = [
      'newmtl tripo_mat_001',
      'map_Kd S08_horse/S08_horse_basecolor.JPEG',
      '',
      'newmtl tripo_mat_002',
      'map_Kd S08_floor/S08_floor_basecolor.JPEG',
      '',
    ].join('\n');
    const expected = [
      'newmtl tripo_mat_001',
      'map_Kd S08_horse_basecolor.JPEG',
      '',
      'newmtl tripo_mat_002',
      'map_Kd S08_floor_basecolor.JPEG',
      '',
    ].join('\n');
    expect(normalizeMtlText(input)).toEqual({ text: expected, changed: true });
  });

  it('preserves CRLF line endings', () => {
    const input = `newmtl m1\r\nmap_Kd dir/file.jpg\r\n`;
    const expected = `newmtl m1\r\nmap_Kd file.jpg\r\n`;
    expect(normalizeMtlText(input)).toEqual({ text: expected, changed: true });
  });
});
