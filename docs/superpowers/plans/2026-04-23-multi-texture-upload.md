# Multi-Texture Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins upload N JPEG textures alongside an OBJ + multi-material MTL, and have the kiosk render each material with its correct texture.

**Architecture:** Client-side: replace single-file texture input with a multi-file input; on upload, conditionally trigger a server-side GLB rebuild when MTL is present. Server-side: new `POST /api/rebuild-glb` endpoint mirrored in both Node (`server/index.ts`) and Flask (`start.py`) that re-runs the existing OBJ→GLB conversion against an OBJ already on disk. No `data.json` schema change; legacy single-texture-no-MTL path preserved for rollback.

**Tech Stack:** React + TypeScript + Vite (admin UI), Express + multer + obj2gltf (Node dev server), Flask + subprocess + tools/obj_to_glb.mjs (production launcher), Vitest (unit tests).

**Spec:** `docs/superpowers/specs/2026-04-23-multi-texture-upload-design.md`

---

## File Structure

**New files:**
- `src/admin/mtlParse.ts` — pure function that parses an MTL file's text and returns the list of texture filenames it references via `map_Kd`.
- `tests/mtlParse.test.ts` — unit tests for `mtlParse`.

**Modified files:**
- `src/admin/api.ts` — add `rebuildGlb()` helper.
- `src/admin/modelFormat.ts` — add helper for filtering JPEGs from a file list.
- `src/admin/ArtifactForm.tsx` — multi-file texture input, list display, rebuild trigger, MTL validation warnings.
- `src/admin/CreationForm.tsx` — same changes as ArtifactForm.
- `server/index.ts` — add `POST /api/rebuild-glb` endpoint.
- `start.py` — add same endpoint, mirroring upload-route conversion logic.
- `tests/api-contract.test.ts` — no edits needed; will pass automatically once both servers expose the new route.

---

## Task 1: MTL parser + tests

**Files:**
- Create: `src/admin/mtlParse.ts`
- Create: `tests/mtlParse.test.ts`

- [ ] **Step 1: Write failing test**

`tests/mtlParse.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run tests/mtlParse.test.ts`
Expected: FAIL — module `../src/admin/mtlParse` not found.

- [ ] **Step 3: Implement mtlParse.ts**

`src/admin/mtlParse.ts`:

```typescript
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
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npx vitest run tests/mtlParse.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/admin/mtlParse.ts tests/mtlParse.test.ts
git commit -m "feat(admin): add MTL map_Kd parser for multi-texture validation"
```

---

## Task 2: modelFormat helper for listing JPEGs

**Files:**
- Modify: `src/admin/modelFormat.ts`

- [ ] **Step 1: Add helper to modelFormat.ts**

Append to `src/admin/modelFormat.ts`:

```typescript
// Returns just the .jpg/.jpeg filenames from a directory listing, sorted
// for stable display order. Used by the admin UI to render the multi-texture
// list independent of upload order.
export function listJpegs(files: string[]): string[] {
  return files.filter((f) => /\.jpe?g$/i.test(f)).sort();
}

// True when a directory contains an .mtl file.
export function hasMtl(files: string[]): boolean {
  return files.some((f) => /\.mtl$/i.test(f));
}

// True when a directory contains an .obj file.
export function hasObj(files: string[]): boolean {
  return files.some((f) => /\.obj$/i.test(f));
}
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `npx tsc -b --noEmit`
Expected: PASS — no type errors. (`hasFormat(files, 'obj')` already exists; the new `hasObj` is a more specific helper used by the rebuild trigger logic.)

- [ ] **Step 3: Commit**

```bash
git add src/admin/modelFormat.ts
git commit -m "feat(admin): add listJpegs/hasMtl/hasObj helpers"
```

---

## Task 3: Add `rebuildGlb` server endpoint (Node)

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Add the endpoint**

Insert in `server/index.ts` *after* the existing `app.post('/api/upload', ...)` block (around line 180, before `app.get('/api/list', ...)`):

```typescript
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
```

- [ ] **Step 2: Verify the dev server still type-checks**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: PASS — no type errors.

- [ ] **Step 3: Smoke-test the endpoint manually**

Open one terminal: `npm run server`
Open another and run:

```bash
# Should 400 — empty path
curl -X POST http://localhost:3000/api/rebuild-glb \
  -H 'Content-Type: application/json' -d '{"objPath":""}'

# Should 400 — wrong extension
curl -X POST http://localhost:3000/api/rebuild-glb \
  -H 'Content-Type: application/json' -d '{"objPath":"foo.txt"}'

# Should 404 — not on disk (assuming no such file)
curl -X POST http://localhost:3000/api/rebuild-glb \
  -H 'Content-Type: application/json' -d '{"objPath":"nonexistent/missing.obj"}'
```

Expected: 400, 400, 404 with the corresponding error messages. Stop the dev server with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add server/index.ts
git commit -m "feat(server): add POST /api/rebuild-glb to re-run obj2gltf on demand"
```

---

## Task 4: Mirror endpoint in Flask launcher

**Files:**
- Modify: `start.py`

- [ ] **Step 1: Add the endpoint to `create_app()`**

Insert in `start.py` *after* the `upload_files_route()` function (the `@app.route("/api/upload", ...)` block ends around line 624) and *before* the `list_artifact_dir()` function:

```python
    @app.route("/api/rebuild-glb", methods=["POST"])
    def rebuild_glb():
        # Mirrors server/index.ts: re-runs OBJ→GLB conversion against a
        # file already on disk, so the admin UI can rebuild the GLB after
        # MTL/JPEG sidecars are uploaded. Reuses tools/obj_to_glb.mjs, the
        # same external tool the upload route invokes.
        data = request.get_json() or {}
        rel = data.get("objPath", "")
        if not rel or not isinstance(rel, str):
            return jsonify({"error": "Invalid objPath"}), 400
        if not rel.lower().endswith(".obj"):
            return jsonify({"error": "objPath must end with .obj"}), 400

        obj_path = ARTIFACTS_DIR / rel
        try:
            resolved = obj_path.resolve()
            resolved.relative_to(ARTIFACTS_DIR.resolve())
        except ValueError:
            return jsonify({"error": "Path traversal not allowed"}), 403
        if resolved == ARTIFACTS_DIR.resolve():
            return jsonify({"error": "Invalid objPath"}), 400
        if not resolved.exists():
            return jsonify({"error": "OBJ not found on disk"}), 404

        glb_path = resolved.with_suffix(".glb")
        obj_tool = BASE_DIR / "tools" / "obj_to_glb.mjs"
        try:
            subprocess.run(
                ["node", str(obj_tool), "--force", str(resolved)],
                capture_output=True,
                text=True,
                check=True,
                cwd=str(BASE_DIR),
            )
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            err_msg = ""
            if isinstance(e, subprocess.CalledProcessError):
                err_msg = (e.stderr or e.stdout or "").strip() or str(e)
            else:
                err_msg = f"node not available: {e}"
            return (
                jsonify({"error": f"obj2gltf failed on {resolved.name}: {err_msg}"}),
                500,
            )

        return jsonify({"glbPath": str(glb_path.relative_to(ARTIFACTS_DIR))})
```

- [ ] **Step 2: Run the API contract test**

Run: `npx vitest run tests/api-contract.test.ts`
Expected: PASS — both servers now expose `POST /api/rebuild-glb`.

- [ ] **Step 3: Commit**

```bash
git add start.py
git commit -m "feat(launcher): add Flask /api/rebuild-glb to match Node dev server"
```

---

## Task 5: Add `rebuildGlb` client API helper

**Files:**
- Modify: `src/admin/api.ts`

- [ ] **Step 1: Append the helper**

Append to `src/admin/api.ts`:

```typescript
// Triggers a server-side OBJ→GLB rebuild for a model whose sidecar files
// (MTL or JPEG textures) just changed on disk. The server overwrites the
// .glb only on success; on failure the previous GLB stays intact and the
// error message is surfaced for the admin UI to display.
export async function rebuildGlb(objPath: string): Promise<string> {
  const res = await fetch(`${BASE}/rebuild-glb`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objPath }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`POST /rebuild-glb failed: ${res.status} ${txt}`);
  }
  const json = (await res.json()) as { glbPath: string };
  return json.glbPath;
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/admin/api.ts
git commit -m "feat(admin): add rebuildGlb() client helper"
```

---

## Task 6: Multi-file texture upload + rebuild trigger in ArtifactForm

**Files:**
- Modify: `src/admin/ArtifactForm.tsx`

- [ ] **Step 1: Update imports and helpers in ArtifactForm.tsx**

Replace the existing import block at the top of `src/admin/ArtifactForm.tsx`:

```typescript
import { useRef, useState } from 'react';
import type { Artifact } from '../types';
import { deleteFile, rebuildGlb, uploadFiles } from './api';
import { useFileList } from '../hooks/useFileList';
import {
  detectFormat,
  hasFormat,
  hasMtl,
  hasObj,
  isMissing,
  listJpegs,
  pickSibling,
  type ModelFormat,
} from './modelFormat';
import { parseMtlTextureRefs, type MtlTextureRef } from './mtlParse';
```

Note: `uploadFile` is still imported in `CreationForm` but `ArtifactForm` now uses `uploadFiles` for the texture batch. Leave the existing OBJ/MTL upload logic using `uploadFile` (those slots stay single-file).

- [ ] **Step 2: Replace `handleTexture` with `handleTextures` (multi-file)**

In `src/admin/ArtifactForm.tsx`, replace the existing `handleTexture` function:

```typescript
  const handleTextures = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const selected = Array.from(list);
    for (const f of selected) {
      const n = f.name.toLowerCase();
      if (!n.endsWith('.jpg') && !n.endsWith('.jpeg')) {
        setUploadError(`必須是 .jpg 貼圖檔案：${f.name}`);
        if (textureRef.current) textureRef.current.value = '';
        return;
      }
    }
    setUploadingSlot('texture');
    setUploadError(null);
    try {
      await uploadFiles(selected, artifact.id);
      // Field-write rule (see spec section 1):
      //   No MTL on disk → set `texture` to first JPEG (legacy uniform-override path).
      //   MTL on disk     → leave `texture` empty (rebuilt GLB carries textures).
      const mtlPresent = hasMtl(files) || Boolean(artifact.mtl);
      if (mtlPresent) {
        onChange({ ...artifact, texture: undefined });
        await maybeRebuild();
      } else {
        onChange({ ...artifact, texture: `${artifact.id}/${selected[0].name}` });
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingSlot(null);
      if (textureRef.current) textureRef.current.value = '';
    }
  };
```

- [ ] **Step 3: Add `maybeRebuild` and adjust `handleMtl`**

Insert helper above `handleObj`:

```typescript
  // Fires a GLB rebuild iff both OBJ and MTL are on disk for this artifact.
  // Returns silently if either is missing — the trigger fires again next
  // time a slot changes, so order of upload doesn't matter.
  const maybeRebuild = async () => {
    if (!hasObj(files) || !hasMtl(files)) return;
    const objName = files.find((f) => /\.obj$/i.test(f));
    if (!objName) return;
    setRebuilding(true);
    try {
      await rebuildGlb(`${artifact.id}/${objName}`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setRebuilding(false);
    }
  };
```

Replace the existing `handleMtl`:

```typescript
  const handleMtl = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.mtl')) {
      setUploadError('必須是 .mtl 檔案');
      if (mtlRef.current) mtlRef.current.value = '';
      return;
    }
    setUploadingSlot('mtl');
    setUploadError(null);
    (async () => {
      try {
        const path = await uploadFiles([file], artifact.id);
        // Clear `texture` on the same change — see spec section 4: the kiosk's
        // GLTF uniform-override would otherwise overwrite the new MTL-driven
        // textures (Canvas3D.tsx:274-281).
        onChange({ ...artifact, mtl: path[0], texture: undefined });
        await maybeRebuild();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : String(err));
      } finally {
        setUploadingSlot(null);
        if (mtlRef.current) mtlRef.current.value = '';
      }
    })();
  };
```

- [ ] **Step 4: Add `rebuilding` state**

Add inside the component, near the other `useState` calls:

```typescript
  const [rebuilding, setRebuilding] = useState(false);
```

- [ ] **Step 5: Trigger rebuild after OBJ upload too**

Modify `handleObj` so that *after* the OBJ upload completes, if MTL is already present, rebuild fires (the upload-time conversion already runs, but if files were uploaded out of order — JPEGs first, then OBJ — the conversion picks them up automatically; this is just a no-op safety net for MTL-after-OBJ flows). Replace `handleObj`:

```typescript
  const handleObj = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const expected = format === 'fbx' ? '.fbx' : '.obj';
    if (!file.name.toLowerCase().endsWith(expected)) {
      setUploadError(`必須是 ${expected} 檔案`);
      if (objRef.current) objRef.current.value = '';
      return;
    }
    setUploadingSlot('obj');
    setUploadError(null);
    try {
      const paths = await uploadFiles([file], artifact.id);
      // Same disambiguation as the old uploadFile() helper: prefer the GLB
      // sibling for OBJ, since the kiosk uses the fast loader by default.
      const preferred = file.name.toLowerCase().endsWith('.obj')
        ? paths.find((p) => p.toLowerCase().endsWith('.glb')) ?? paths[0]
        : paths[0];
      onChange({ ...artifact, model: preferred });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingSlot(null);
      if (objRef.current) objRef.current.value = '';
    }
  };
```

- [ ] **Step 6: Verify type-check + lint**

Run: `npx tsc -b --noEmit && npx eslint src/admin/ArtifactForm.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/admin/ArtifactForm.tsx
git commit -m "feat(admin): multi-file texture upload + rebuild trigger in ArtifactForm"
```

---

## Task 7: Replace single-texture UploadRow with multi-texture row in ArtifactForm

**Files:**
- Modify: `src/admin/ArtifactForm.tsx`

- [ ] **Step 1: Add `TextureMultiRow` component**

Add at the bottom of `src/admin/ArtifactForm.tsx`, after the existing `FormatToggle` component:

```typescript
interface TextureMultiRowProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  rebuilding: boolean;
  jpegs: string[];          // filenames from useFileList, already filtered
  legacyTexture?: string;   // value of artifact.texture if set (single-texture path)
  legacyMissing: boolean;
  mtlRefs: MtlTextureRef[]; // parsed map_Kd refs from current MTL (empty if no MTL)
  onRemoveJpeg: (filename: string) => void;
  onRemoveLegacy: () => void;
}

function TextureMultiRow({
  inputRef,
  onChange,
  uploading,
  rebuilding,
  jpegs,
  legacyTexture,
  legacyMissing,
  mtlRefs,
  onRemoveJpeg,
  onRemoveLegacy,
}: TextureMultiRowProps) {
  // Cross-check JPEGs on disk vs. map_Kd references in MTL.
  const refFiles = mtlRefs.map((r) => r.file);
  const missingFromDisk = refFiles.filter((f) => !jpegs.includes(f) && !f.includes('/'));
  const unreferenced = jpegs.filter((j) => !refFiles.includes(j));
  const subpathRefs = mtlRefs.filter((r) => r.hasSubpath);

  return (
    <div className="file-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 180 }}>貼圖 JPG（可多選）</span>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,image/jpeg"
          multiple
          onChange={onChange}
          style={{ color: 'var(--muted)', fontSize: 13 }}
        />
        {uploading && <span style={{ color: 'var(--amber)', fontSize: 13 }}>上傳中…</span>}
        {rebuilding && <span style={{ color: 'var(--amber)', fontSize: 13 }}>重新封裝模型中…</span>}
      </div>

      {legacyTexture && (
        <div className="file-path" style={legacyMissing ? { color: 'var(--danger)' } : undefined}>
          {legacyMissing ? '檔案遺失' : legacyTexture}
          <button
            type="button"
            className="file-remove"
            onClick={onRemoveLegacy}
            aria-label="移除檔案"
            title="移除檔案"
          >
            ×
          </button>
        </div>
      )}

      {jpegs.map((j) => (
        <div key={j} className="file-path">
          {j}
          <button
            type="button"
            className="file-remove"
            onClick={() => onRemoveJpeg(j)}
            aria-label="移除檔案"
            title="移除檔案"
          >
            ×
          </button>
        </div>
      ))}

      {missingFromDisk.map((f) => (
        <span key={`miss-${f}`} style={{ color: 'var(--amber)', fontSize: 12 }}>
          MTL 引用了 {f}，尚未上載
        </span>
      ))}
      {unreferenced.map((f) => (
        <span key={`unref-${f}`} style={{ color: 'var(--dim)', fontSize: 12 }}>
          {f} 未被 MTL 引用
        </span>
      ))}
      {subpathRefs.map((r) => (
        <span key={`sub-${r.file}`} style={{ color: 'var(--danger)', fontSize: 12 }}>
          MTL 使用子目錄路徑（{r.file}），目前不支援
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add MTL parsing state + effect**

Inside `ArtifactForm`, near the top, add:

```typescript
  const [mtlRefs, setMtlRefs] = useState<MtlTextureRef[]>([]);

  // Re-parse MTL whenever its path changes. Fetch is cheap; MTL is small.
  useEffect(() => {
    if (!artifact.mtl) { setMtlRefs([]); return; }
    let cancelled = false;
    fetch(`/artifacts/${artifact.mtl}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!cancelled) setMtlRefs(parseMtlTextureRefs(text));
      })
      .catch(() => { if (!cancelled) setMtlRefs([]); });
    return () => { cancelled = true; };
  }, [artifact.mtl]);
```

Add `useEffect` to the existing React import:

```typescript
import { useEffect, useRef, useState } from 'react';
```

- [ ] **Step 3: Replace texture UploadRow in JSX**

In the JSX, find the block that renders the texture `UploadRow` (under `format === 'obj'`, the first `<UploadRow label="貼圖 JPG..." ...>`). Replace it with:

```tsx
              <TextureMultiRow
                inputRef={textureRef}
                onChange={handleTextures}
                uploading={uploadingSlot === 'texture'}
                rebuilding={rebuilding}
                jpegs={listJpegs(files)}
                legacyTexture={artifact.texture}
                legacyMissing={isMissing(artifact.texture, files)}
                mtlRefs={mtlRefs}
                onRemoveJpeg={(filename) =>
                  removeFile(`${artifact.id}/${filename}`, () => artifact)
                }
                onRemoveLegacy={() =>
                  removeFile(artifact.texture, () => ({ ...artifact, texture: undefined }))
                }
              />
```

Note: `removeFile` second arg returns the *whole* artifact. For the per-JPEG delete we don't change any data.json field — the JPEGs are tracked via the directory listing, not the manifest — so we return `artifact` unchanged.

- [ ] **Step 4: Trigger rebuild after JPEG deletion**

Update `removeFile` calls for JPEG deletion. After removal, call `maybeRebuild`. Modify the per-jpeg `onRemoveJpeg`:

```tsx
                onRemoveJpeg={async (filename) => {
                  await removeFile(`${artifact.id}/${filename}`, () => artifact);
                  await maybeRebuild();
                }}
```

- [ ] **Step 5: Verify type-check + lint**

Run: `npx tsc -b --noEmit && npx eslint src/admin/ArtifactForm.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/admin/ArtifactForm.tsx
git commit -m "feat(admin): render multi-texture list with MTL ↔ JPEG validation in ArtifactForm"
```

---

## Task 8: Apply the same changes to CreationForm

**Files:**
- Modify: `src/admin/CreationForm.tsx`

- [ ] **Step 1: Mirror Task 6 + Task 7 in CreationForm**

Apply the same set of changes as Tasks 6 and 7 to `src/admin/CreationForm.tsx`:

- Update imports: add `rebuildGlb`, `uploadFiles`, `hasMtl`, `hasObj`, `listJpegs`, `parseMtlTextureRefs`, `MtlTextureRef`, and `useEffect`.
- Replace `handleTexture` with multi-file `handleTextures`. Use `destDir` (not `artifact.id`) as the upload destination — that's the key shape difference vs. ArtifactForm. The legacy single-texture write becomes:
  ```typescript
  onChange({ ...creation, texture: `${destDir}/${selected[0].name}` });
  ```
- Add `maybeRebuild` helper:
  ```typescript
  const maybeRebuild = async () => {
    if (!hasObj(files) || !hasMtl(files)) return;
    const objName = files.find((f) => /\.obj$/i.test(f));
    if (!objName) return;
    setRebuilding(true);
    try {
      await rebuildGlb(`${destDir}/${objName}`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setRebuilding(false);
    }
  };
  ```
- Update `handleMtl` to clear `creation.texture` and call `maybeRebuild` (analogous to ArtifactForm).
- Update `handleObj` to use `uploadFiles` directly (mirroring ArtifactForm) so we control GLB-vs-OBJ disambiguation locally.
- Add `rebuilding` state.
- Add `mtlRefs` state + the same `useEffect` to fetch and parse `creation.mtl` (using `/artifacts/${creation.mtl}`).
- Add the same `TextureMultiRow` component definition at the bottom of the file (or extract it — see Task 9).
- Replace the texture `UploadRow` in JSX with `TextureMultiRow`. Use `destDir` as the prefix when constructing per-jpeg paths.

- [ ] **Step 2: Verify type-check + lint**

Run: `npx tsc -b --noEmit && npx eslint src/admin/CreationForm.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/admin/CreationForm.tsx
git commit -m "feat(admin): multi-texture upload + rebuild trigger in CreationForm"
```

---

## Task 9: Extract `TextureMultiRow` to shared module (DRY)

**Files:**
- Create: `src/admin/TextureMultiRow.tsx`
- Modify: `src/admin/ArtifactForm.tsx`
- Modify: `src/admin/CreationForm.tsx`

- [ ] **Step 1: Move `TextureMultiRow` to its own file**

Create `src/admin/TextureMultiRow.tsx` and move the entire `TextureMultiRow` component + its `TextureMultiRowProps` interface from `ArtifactForm.tsx` into it. Add `export` to the function and the interface. Keep imports for `MtlTextureRef`:

```typescript
import type { MtlTextureRef } from './mtlParse';

export interface TextureMultiRowProps {
  // ...same as before...
}

export function TextureMultiRow(props: TextureMultiRowProps) {
  // ...same body as before...
}
```

- [ ] **Step 2: Update ArtifactForm.tsx import**

Replace the inline `TextureMultiRow` definition with:

```typescript
import { TextureMultiRow } from './TextureMultiRow';
```

Remove the inline component definition + interface from `ArtifactForm.tsx`.

- [ ] **Step 3: Update CreationForm.tsx import**

Replace the inline `TextureMultiRow` (added in Task 8) with the same import:

```typescript
import { TextureMultiRow } from './TextureMultiRow';
```

Remove the inline component definition.

- [ ] **Step 4: Verify type-check + lint**

Run: `npx tsc -b --noEmit && npx eslint src/admin/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/TextureMultiRow.tsx src/admin/ArtifactForm.tsx src/admin/CreationForm.tsx
git commit -m "refactor(admin): extract TextureMultiRow into shared component"
```

---

## Task 10: End-to-end manual verification

**Files:** None (verification only).

- [ ] **Step 1: Start the dev stack**

Run: `npm run dev:all`
Wait until both servers are listening (`Vite` on 5173, `Express` on 3000). Open `http://localhost:5173/admin`.

- [ ] **Step 2: Create test artifact and upload all four files**

In the admin UI:
1. Create a new artifact titled "test-multi-texture".
2. Select OBJ format. Upload `tests/test.obj`.
3. Upload `tests/test.mtl`.
4. In the texture slot, select **both** `tests/S08_horse_basecolor.JPEG` and `tests/S08_floor_basecolor.JPEG` in one go (Cmd-click).

Expected during upload:
- Texture row shows "上傳中…" then "重新封裝模型中…"
- Two JPEG filenames appear in the texture list, each with × button.
- No yellow/grey/red warnings (filenames match the MTL `map_Kd` lines exactly).

- [ ] **Step 3: Verify on the kiosk**

Open `http://localhost:5173/` (kiosk). Navigate to the new artifact.

Expected:
- Model renders with **two distinct textures** — horse mesh has the horse texture, floor mesh has the floor texture.
- No console errors related to MTL or texture loading.

- [ ] **Step 4: Verify rebuild after JPEG removal**

Back in the admin UI for the same artifact, click × next to one of the JPEGs.

Expected:
- "重新封裝模型中…" briefly appears.
- The kiosk (after navigating away and back) shows the model with only the remaining texture; the other material falls back to default colour.

- [ ] **Step 5: Verify backward compatibility**

In the admin UI, find an existing creation with `texture` set and no MTL (legacy single-texture case). Confirm that:
- The texture row displays the legacy single path, with × button (not the multi-jpeg list).
- No "重新封裝模型中…" indicator appears (rebuild does not fire for no-MTL case).
- The kiosk renders the model with the uniform texture override exactly as before.

- [ ] **Step 6: Verify Flask launcher parity**

Stop the dev stack. Run: `./start.sh` (or `python start.py`).
Open `http://localhost:8080/admin`. Repeat Step 2 with a different artifact name. Confirm the same behaviour.

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS, including `tests/api-contract.test.ts` and `tests/mtlParse.test.ts`.

- [ ] **Step 8: Run lint + typecheck across the whole project**

Run: `npm run lint && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 9: Final commit (if any cleanup needed)**

If any minor fixes came out of verification, commit them with a single descriptive message. Otherwise nothing to do.

---

## Self-review notes

**Spec coverage check:**
- Section 1 (multi-file slot, field-write rule) → Task 6, 8
- Section 2 (texture-list UI) → Task 7, 8, 9
- Section 3 (rebuild endpoint) → Task 3, 4
- Section 4 (rebuild trigger) → Task 6 (`maybeRebuild`), Task 7 (post-JPEG-delete), Task 8 (CreationForm mirror)
- Section 5 (MTL ↔ JPEG validation) → Task 7 (warning rendering), Task 1 (parser)
- Section 6 (render path unchanged) → no task needed; verified in Task 10 step 3
- Backward compatibility → Task 6 field-write rule, Task 10 step 5

**Type consistency check:**
- `rebuildGlb(objPath)` signature matches between `api.ts` (Task 5), Node endpoint (Task 3), Flask endpoint (Task 4).
- `MtlTextureRef` shape matches between `mtlParse.ts` (Task 1) and `TextureMultiRow.tsx` (Task 9).
- `maybeRebuild` is identically structured in ArtifactForm (Task 6) and CreationForm (Task 8); only difference is `artifact.id` vs `destDir` for path construction.

**Placeholder scan:** No "TBD" / "TODO" markers; every code step shows the actual code.
