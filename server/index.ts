import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8010;
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

app.post('/api/upload', upload.array('files'), (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    res.status(400).json({ error: 'No files uploaded' });
    return;
  }
  const paths = files.map((f) => path.relative(ARTIFACTS_DIR, f.path));
  res.json({ paths });
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
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Admin server running on http://localhost:${PORT}`);
});
