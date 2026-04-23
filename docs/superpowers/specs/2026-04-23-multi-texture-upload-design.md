# Multi-texture upload for OBJ models

**Status:** Draft
**Date:** 2026-04-23
**Scope:** Admin upload UX + server conversion pipeline

## Problem

Some 3D models in the museum exhibit are composed of multiple sub-meshes that
each carry their own JPEG texture. The current MTL file encodes this with
multiple `newmtl` blocks, each with its own `map_Kd` reference, e.g.:

```
newmtl tripo_mat_b1f3...001
map_Kd S08_horse_basecolor.JPEG

newmtl tripo_mat_dc95...002
map_Kd S08_floor_basecolor.JPEG
```

The renderer's MTL path can already resolve this correctly via
`MTLLoader.setResourcePath` (Canvas3D.tsx:91) — provided the JPEGs sit beside
the MTL on disk *and* the kiosk uses the OBJ render path.

Two problems block this from working today:

1. **Upload UI accepts only one texture per artifact/creation.** The texture
   slot is a single `<input type="file">` with no `multiple` attribute, so
   admins cannot upload `S08_horse_basecolor.JPEG` and `S08_floor_basecolor.JPEG`
   together (ArtifactForm.tsx:177-182, CreationForm.tsx:258-267).

2. **The OBJ→GLB conversion runs at OBJ-upload time, before MTL/JPEGs exist on
   disk.** `obj2gltf` embeds whatever it finds beside the OBJ at conversion
   time (server/index.ts:155-173). With no MTL/JPEGs present, the resulting
   GLB is texture-less. The kiosk then falls back to the single uniform
   `texture` override (Canvas3D.tsx:274-278), which paints every mesh with the
   same JPEG — wrong for multi-material models.

## Goals

- Allow admin to upload N JPEG textures in one slot for a single
  artifact/creation.
- Ensure the kiosk renders multi-material models with each material correctly
  textured.
- Preserve the existing single-texture path (no MTL → uniform JPEG override)
  for backward compatibility and rollback.

## Non-goals

- Supporting multiple OBJ files combined into one renderable scene.
  (Combination must happen upstream in the modelling tool; we handle the
  resulting single OBJ + single MTL + N JPEGs.)
- Supporting MTL files that reference textures via subdirectory paths
  (e.g. `map_Kd textures/foo.jpg`). Validation will warn admin if it sees
  such references.
- Changing the FBX path. FBX embeds materials/textures and is unaffected.

## Design

### 1. Multi-file texture slot in admin UI

Both `ArtifactForm.tsx` and `CreationForm.tsx` get the same change:

- The texture `<input type="file">` gains `multiple`, with
  `accept=".jpg,.jpeg,image/jpeg"` unchanged.
- A new handler `handleTextures` (replacing `handleTexture`) iterates the
  selected files, validates each (`.jpg` / `.jpeg`), and uploads them as one
  batch via the existing `uploadFiles` API (api.ts:23-35).
- Validation rejects the *whole* batch if any file has the wrong extension —
  shown in the existing `uploadError` slot.
- The current single `texture` field on `Artifact` / `Creation` remains. Its
  meaning narrows to "**uniform fallback**: applied to every mesh when no MTL
  is present." Field-write rule:
  - **No MTL on disk** → set `texture` to the (single or first) uploaded
    JPEG path, exactly as today. Backward-compatible legacy path; no rebuild.
  - **MTL on disk** → leave `texture` empty (or clear it if previously set —
    see section 4 for why). The rebuilt GLB carries textures internally.

### 2. Texture-list UI

The texture row's "current path" display becomes a list of all `.jpg`/`.jpeg`
filenames in the artifact/creation directory, derived from the existing
`useFileList` hook output. Each filename has its own `×` button that calls
`deleteFile` for that one texture.

If `data.json.texture` is set (legacy single-texture case), it continues to
render as it does today (single path with × button), unchanged.

### 3. Auto-rebuild GLB endpoint

New server endpoint:

```
POST /api/rebuild-glb
Body: { objPath: string }     // path relative to public/artifacts/
Response: { glbPath: string } // path relative to public/artifacts/
```

Implementation:

- Validate `objPath` via `safeResolve` (server/index.ts:91-99). Reject paths
  outside `ARTIFACTS_DIR` or with traversal attempts.
- Verify the OBJ file exists on disk; 404 if not.
- Run `convertObjToGlb(objPath, { binary: true })`. The function reads MTL
  + textures from the same directory automatically (already proven in the
  upload path).
- Write to `<basename>.glb`, overwriting any existing GLB at that path.
- On `obj2gltf` failure, return 500 with the error message (matches existing
  upload-path behavior).

### 4. Auto-rebuild trigger (client)

The rebuild fires only when **MTL + OBJ are both on disk** (post-upload).
Specifically:

- After a successful **texture upload**: if MTL exists in the directory, fire
  rebuild. Otherwise skip (legacy uniform-override path).
- After a successful **MTL upload**: if OBJ exists in the directory, fire
  rebuild. Also clear any previously-set `texture` field on the same write
  via `onChange` — without this, the kiosk's GLTF path would apply the old
  uniform override on top of the new MTL-driven textures (Canvas3D.tsx:274-281)
  and overwrite them.
- After a successful **OBJ upload**: the existing upload-time conversion
  already runs `obj2gltf` server-side. If MTL+JPEGs are already on disk by
  then, the conversion picks them up; no separate rebuild call needed.
- After a successful **texture or MTL deletion**: same trigger rules apply
  (rebuild only if MTL+OBJ both still on disk).

`useFileList` already polls the directory at ~1Hz, so "MTL on disk" /
"OBJ on disk" reads from local state, no extra request.

While the rebuild call is in flight, the form shows "重新封裝模型中…" next
to the texture row. A failed rebuild surfaces the server error in the
existing `uploadError` slot. The previous GLB stays on disk because the
server overwrites only on `obj2gltf` success.

### 5. Validation: MTL ↔ JPEG cross-check

When the texture *or* MTL slot's contents change, the form parses the MTL on
the client side (a quick fetch of the MTL text + a regex over `map_Kd`
lines). It then compares the referenced filenames against the JPEGs present
in the directory:

- Filenames in MTL but not on disk → yellow warning: `"MTL 引用了 X.jpeg，
  尚未上載"`
- JPEGs on disk not referenced by MTL → grey hint: `"X.jpeg 未被 MTL 引用"`
  (informational, not blocking)
- `map_Kd` value contains a `/` → red warning: `"MTL 使用子目錄路徑，目前不支援"`

These are display-only; they do not block uploads or rebuilds.

### 6. Render path

No code changes to Canvas3D.tsx required. Once the GLB is rebuilt with
embedded textures, the GLTF render path (`GLTFRotatingModel`) loads it
correctly. The `texture` field stays empty for multi-texture artifacts, so
the uniform-override branch (Canvas3D.tsx:274-278) is skipped.

## Backward compatibility

- Existing creations with `texture` set + no MTL: unchanged. No rebuild ever
  fires for this configuration. Renderer applies the uniform override exactly
  as today.
- Existing creations with `texture` + MTL both set (legacy single-texture
  with MTL): on the next admin edit that touches the texture or MTL slot,
  the spec's "clear `texture` on rebuild" rule kicks in. The rebuilt GLB
  embeds textures correctly and the uniform override is no longer needed.
  No automatic migration — the change happens lazily as admins edit.
- Admins who downgrade from multi-texture back to single-texture do so by
  removing the JPEGs they don't want — the rebuild then produces a GLB with
  only the remaining texture(s).

## File changes (summary)

- `src/admin/ArtifactForm.tsx` — multi-file input, list display, rebuild trigger,
  MTL validation.
- `src/admin/CreationForm.tsx` — same changes as above.
- `src/admin/api.ts` — add `rebuildGlb(objPath)` helper.
- `src/admin/modelFormat.ts` — add helpers: list textures from file list,
  parse MTL `map_Kd` references.
- `server/index.ts` — add `POST /api/rebuild-glb` endpoint.
- `start.py` — mirror the new endpoint in the Flask launcher (per the
  precedent in `a4e8c68: sync Flask launcher API with Node dev server`).

## Testing

Manual end-to-end test using the files in `/tests/`:

1. Create a new artifact in the admin UI.
2. Upload `test.obj` → kiosk shows untextured combined model.
3. Upload `test.mtl` → rebuild fires; kiosk still untextured (JPEGs missing).
4. Upload both `S08_horse_basecolor.JPEG` and `S08_floor_basecolor.JPEG` in
   one shot → rebuild fires; kiosk shows horse-with-floor with each material
   correctly textured.
5. Remove one JPEG → rebuild fires; kiosk shows the model with only the
   remaining texture (the other material falls back to default).
6. Verify legacy single-texture creations (existing `data.json` entries with
   `texture` set, no MTL) render exactly as before.

## Open questions

None at design time. Anything that turns up during implementation goes into
the implementation plan.
