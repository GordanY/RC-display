import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const ARTIFACTS_DIR = path.join(__dirname, '..', 'public', 'artifacts');
const DATA_FILE = path.join(ARTIFACTS_DIR, 'data.json');

app.use(cors());
app.use(express.json());

// Read exhibit data
app.get('/api/data', (_req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  res.json(data);
});

// Save exhibit data
app.put('/api/data', (req, res) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

// File upload
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dest = path.join(ARTIFACTS_DIR, (req.body as Record<string, string>).path || '');
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  const relativePath = path.relative(ARTIFACTS_DIR, req.file.path);
  res.json({ path: relativePath });
});

// Delete a file or directory
app.delete('/api/files', (req, res) => {
  const filePath = path.join(ARTIFACTS_DIR, (req.body as Record<string, string>).path);
  if (!filePath.startsWith(ARTIFACTS_DIR)) {
    res.status(403).json({ error: 'Path traversal not allowed' });
    return;
  }
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { recursive: true });
  }
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Admin server running on http://localhost:${PORT}`);
});
