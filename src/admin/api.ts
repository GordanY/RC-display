import type { ExhibitData } from '../types';

const BASE = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

export async function fetchData(): Promise<ExhibitData> {
  const res = await fetch(`${BASE}/data`);
  if (!res.ok) throw new Error(`GET /data failed: ${res.status}`);
  return res.json();
}

export async function saveData(data: ExhibitData): Promise<void> {
  const res = await fetch(`${BASE}/data`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`PUT /data failed: ${res.status} ${txt}`);
  }
}

export async function uploadFiles(files: File[], destDir: string): Promise<string[]> {
  if (files.length === 0) return [];
  const form = new FormData();
  form.append('path', destDir);
  for (const f of files) form.append('files', f, f.name);
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`POST /upload failed: ${res.status} ${txt}`);
  }
  const json = (await res.json()) as { paths: string[] };
  return json.paths;
}

export async function uploadFile(file: File, destDir: string): Promise<string> {
  const paths = await uploadFiles([file], destDir);
  // Server converts uploaded .obj files to .glb siblings and returns both
  // paths. Prefer the GLB so the kiosk uses the fast loader by default; the
  // original OBJ stays on disk, so rollback is flipping the extension in
  // data.json (no re-upload, no code change).
  if (file.name.toLowerCase().endsWith('.obj')) {
    const glb = paths.find((p) => p.toLowerCase().endsWith('.glb'));
    if (glb) return glb;
  }
  return paths[0];
}

export async function listFiles(dir: string): Promise<string[]> {
  const res = await fetch(`${BASE}/list?path=${encodeURIComponent(dir)}`);
  if (!res.ok) throw new Error(`GET /list failed: ${res.status}`);
  const json = (await res.json()) as { files: string[] };
  return json.files;
}

export async function deleteFile(relPath: string): Promise<void> {
  const res = await fetch(`${BASE}/files`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: relPath }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`DELETE /files failed: ${res.status} ${txt}`);
  }
}
