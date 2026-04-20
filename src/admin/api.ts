import type { ExhibitData } from '../types';

const BASE = import.meta.env.DEV ? 'http://localhost:8010/api' : '/api';

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
  return paths[0];
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
