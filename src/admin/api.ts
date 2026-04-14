const BASE = 'http://localhost:3001/api';

export async function fetchData() {
  const res = await fetch(`${BASE}/data`);
  return res.json();
}

export async function saveData(data: unknown) {
  await fetch(`${BASE}/data`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function uploadFile(file: File, destPath: string): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('path', destPath);
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form });
  const json = await res.json();
  return json.path;
}

export async function deleteFile(filePath: string) {
  await fetch(`${BASE}/files`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath }),
  });
}
