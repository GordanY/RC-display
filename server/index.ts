import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// @ts-expect-error obj2gltf ships no type declarations; minimal shim below.
import obj2gltf from 'obj2gltf';

type Obj2GltfFn = (
  objPath: string,
  options?: { binary?: boolean },
) => Promise<Buffer>;
const convertObjToGlb = obj2gltf as Obj2GltfFn;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const ARTIFACTS_DIR = path.join(__dirname, '..', 'public', 'artifacts');
const DATA_FILE = path.join(ARTIFACTS_DIR, 'data.json');

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ exhibitTitle: '', artifacts: [] }, null, 2));
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));

type DisplayMode = 'name-school' | 'school-name';

interface Creation {
  id: string;
  name: string;
  school: string;
  displayMode: DisplayMode;
  preview: string;
  model: string;
  texture?: string;
  mtl?: string;
}

interface Artifact {
  id: string;
  title: string;
  description: string;
  model: string;
  texture?: string;
  mtl?: string;
  creations: Creation[];
}

interface ExhibitData {
  exhibitTitle: string;
  artifacts: Artifact[];
}

function isStr(v: unknown): v is string {
  return typeof v === 'string';
}

function isOptStr(v: unknown): v is string | undefined {
  return v === undefined || typeof v === 'string';
}

function validateExhibitData(body: unknown): body is ExhibitData {
  if (!body || typeof body !== 'object') return false;
  const d = body as Record<string, unknown>;
  if (!isStr(d.exhibitTitle)) return false;
  if (!Array.isArray(d.artifacts)) return false;
  for (const a of d.artifacts) {
    if (!a || typeof a !== 'object') return false;
    const art = a as Record<string, unknown>;
    if (!isStr(art.id) || !isStr(art.title) || !isStr(art.description) || !isStr(art.model)) return false;
    if (!isOptStr(art.texture) || !isOptStr(art.mtl)) return false;
    if (!Array.isArray(art.creations)) return false;
    for (const c of art.creations) {
      if (!c || typeof c !== 'object') return false;
      const cr = c as Record<string, unknown>;
      if (!isStr(cr.id) || !isStr(cr.name) || !isStr(cr.school)) return false;
      if (!isStr(cr.preview) || !isStr(cr.model)) return false;
      if (!isOptStr(cr.texture) || !isOptStr(cr.mtl)) return false;
      if (cr.displayMode !== 'name-school' && cr.displayMode !== 'school-name') return false;
    }
  }
  return true;
}

function safeResolve(relative: string): string | null {
  if (typeof relative !== 'string') return null;
  if (relative.length === 0) return ARTIFACTS_DIR;
  if (path.isAbsolute(relative)) return null;
  const resolved = path.resolve(ARTIFACTS_DIR, relative);
  const rel = path.relative(ARTIFACTS_DIR, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return resolved;
}

function atomicWriteJson(filePath: string, data: unknown): void {
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

app.get('/api/data', (_req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as ExhibitData;
  res.json(data);
});

app.put('/api/data', (req, res) => {
  if (!validateExhibitData(req.body)) {
    res.status(400).json({ error: 'Invalid ExhibitData payload' });
    return;
  }
  atomicWriteJson(DATA_FILE, req.body);
  res.json({ ok: true });
});

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const relPath = (req.body as Record<string, string>).path ?? '';
    const resolved = safeResolve(relPath);
    if (!resolved) {
      cb(new Error('Invalid upload path'), '');
      return;
    }
    fs.mkdirSync(resolved, { recursive: true });
    cb(null, resolved);
  },
  filename: (_req, file, cb) => {
    const base = path.basename(file.originalname);
    if (base !== file.originalname || base.includes('..')) {
      cb(new Error('Invalid filename'), '');
      return;
    }
    cb(null, base);
  },
});

const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

app.post('/api/upload', upload.array('files'), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    res.status(400).json({ error: 'No files uploaded' });
    return;
  }

  // Synchronously convert any uploaded .obj to a .glb sibling. Keeps OBJ on
  // disk so the admin can roll back to the OBJ path in data.json without
  // re-uploading. Fails loud: if obj2gltf throws, return 500 with the error
  // so the admin UI can surface it (better than a silently broken kiosk).
  const converted: string[] = [];
  for (const f of files) {
    if (!f.originalname.toLowerCase().endsWith('.obj')) continue;
    const objPath = f.path;
    const glbPath = objPath.replace(/\.obj$/i, '.glb');
    try {
      const glb = await convertObjToGlb(objPath, { binary: true });
      await fs.promises.writeFile(glbPath, glb);
      converted.push(path.relative(ARTIFACTS_DIR, glbPath));
    } catch (err) {
      // Best-effort cleanup of a partial .glb; swallow unlink errors.
      fs.promises.unlink(glbPath).catch(() => {});
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({
        error: `obj2gltf failed on ${f.originalname}: ${msg}`,
      });
      return;
    }
  }

  // Return every file that now exists on disk: uploaded originals (including
  // the OBJ) plus any newly written GLBs. Admin/client picks which to store
  // in data.json — typically the GLB for the kiosk and nothing else.
  const uploaded = files.map((f) => path.relative(ARTIFACTS_DIR, f.path));
  res.json({ paths: [...uploaded, ...converted] });
});

// Re-runs obj2gltf against an OBJ already on disk. Triggered by the admin UI
// after MTL/JPEG slots change so the GLB picks up the new sidecar files.
// Overwrites the existing GLB on success only — failure leaves the previous
// GLB intact, mirroring the upload-route behaviour.
app.post('/api/rebuild-glb', async (req, res) => {
  const objPath = (req.body as Record<string, string>).objPath;
  const resolved = safeResolve(objPath);
  if (!resolved || resolved === ARTIFACTS_DIR) {
    res.status(400).json({ error: 'Invalid objPath' });
    return;
  }
  if (!resolved.toLowerCase().endsWith('.obj')) {
    res.status(400).json({ error: 'objPath must end with .obj' });
    return;
  }
  if (!fs.existsSync(resolved)) {
    res.status(404).json({ error: 'OBJ not found on disk' });
    return;
  }

  const glbAbs = resolved.replace(/\.obj$/i, '.glb');
  try {
    const glb = await convertObjToGlb(resolved, { binary: true });
    await fs.promises.writeFile(glbAbs, glb);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: `obj2gltf failed on ${path.basename(resolved)}: ${msg}`,
    });
    return;
  }

  res.json({ glbPath: path.relative(ARTIFACTS_DIR, glbAbs) });
});

// List filenames in an artifacts subdirectory. Admin polls this per-form
// every ~1s so "formats present on disk" state reflects manual filesystem
// edits (e.g. file deleted via OS Finder). Missing dir → empty list so a
// freshly-created artifact/creation can poll before its dir exists.
app.get('/api/list', (req, res) => {
  const rel = typeof req.query.path === 'string' ? req.query.path : '';
  if (!rel) {
    res.status(400).json({ error: 'path required' });
    return;
  }
  const resolved = safeResolve(rel);
  if (!resolved || resolved === ARTIFACTS_DIR) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }
  if (!fs.existsSync(resolved)) {
    res.json({ files: [] });
    return;
  }
  const entries = fs.readdirSync(resolved, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  res.json({ files });
});

app.delete('/api/files', (req, res) => {
  const rel = (req.body as Record<string, string>).path;
  const resolved = safeResolve(rel);
  if (!resolved) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }
  if (resolved === ARTIFACTS_DIR) {
    res.status(400).json({ error: 'Cannot delete artifacts root' });
    return;
  }
  if (fs.existsSync(resolved)) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
  // Cascade: deleting a source also removes its generated sibling. Today the
  // only generation is OBJ→GLB at upload time, so removing `foo.obj` also
  // removes `foo.glb`. The reverse is intentionally not cascaded — GLB is
  // derived, OBJ is the source of truth for rollback.
  if (/\.obj$/i.test(resolved)) {
    const glbPath = resolved.replace(/\.obj$/i, '.glb');
    fs.rmSync(glbPath, { force: true });
  }
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Admin server running on http://localhost:${PORT}`);
});
