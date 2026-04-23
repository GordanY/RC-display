import { useEffect, useRef, useState } from 'react';
import type { Artifact } from '../types';
import { deleteFile, listFiles, rebuildGlb, uploadFiles } from './api';
import { useFileList } from '../hooks/useFileList';
import {
  detectFormat,
  hasFormat,
  hasMtl,
  isMissing,
  listJpegs,
  pickSibling,
  type ModelFormat,
} from './modelFormat';
import { parseMtlTextureRefs, type MtlTextureRef } from './mtlParse';
import { TextureMultiRow } from './TextureMultiRow';

interface Props {
  artifact: Artifact;
  onChange: (artifact: Artifact) => void;
  onDelete: () => void;
}

type UploadSlot = 'obj' | 'texture' | 'mtl';

export default function ArtifactForm({ artifact, onChange, onDelete }: Props) {
  const [uploadingSlot, setUploadingSlot] = useState<UploadSlot | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [mtlRefs, setMtlRefs] = useState<MtlTextureRef[]>([]);
  const objRef = useRef<HTMLInputElement>(null);
  const textureRef = useRef<HTMLInputElement>(null);
  const mtlRef = useRef<HTMLInputElement>(null);

  const files = useFileList(artifact.id);
  // Format is a sticky UI choice: initial value derived from the stored
  // model path, but the user may switch to FBX before any FBX file exists
  // (model goes empty until they upload). We must keep showing the FBX upload
  // row in that gap, hence local state rather than deriving every render.
  const [format, setFormat] = useState<ModelFormat>(detectFormat(artifact.model));
  const hasObj = hasFormat(files, 'obj');
  const hasFbx = hasFormat(files, 'fbx');

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

  const switchFormat = (target: ModelFormat) => {
    if (target === format) return;
    setFormat(target);
    const sibling = pickSibling(files, target);
    const nextModel = sibling ? `${artifact.id}/${sibling}` : '';
    onChange({ ...artifact, model: nextModel });
  };

  // Removes the file at `path` from disk (best-effort — missing files still
  // succeed) and clears the data.json field via `clear`. The 1s file-list
  // poll picks up the disk change on the next tick.
  const removeFile = async (path: string | undefined, clear: () => Artifact) => {
    if (path) {
      try {
        await deleteFile(path);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : String(err));
        return;
      }
    }
    setUploadError(null);
    onChange(clear());
  };

  // Fires a GLB rebuild iff both OBJ and MTL are on disk for this artifact.
  // Re-queries the directory (rather than reading the useFileList snapshot)
  // so a JUST-uploaded sidecar file is visible to the trigger — the polled
  // `files` state lags upload completion by up to 1s.
  const maybeRebuild = async () => {
    let live: string[];
    try {
      live = await listFiles(artifact.id);
    } catch {
      return;
    }
    if (!live.some((f) => /\.mtl$/i.test(f))) return;
    const objName = live.find((f) => /\.obj$/i.test(f));
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
      const paths = await uploadFiles(selected, artifact.id);
      // Field-write rule (spec §1):
      //   No MTL on disk → set `texture` to first JPEG (legacy uniform-override path).
      //   MTL on disk     → leave `texture` empty (rebuilt GLB carries textures).
      const mtlPresent = hasMtl(files) || Boolean(artifact.mtl);
      if (mtlPresent) {
        onChange({ ...artifact, texture: undefined });
        await maybeRebuild();
      } else {
        onChange({ ...artifact, texture: paths[0] });
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingSlot(null);
      if (textureRef.current) textureRef.current.value = '';
    }
  };

  const handleMtl = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.mtl')) {
      setUploadError('必須是 .mtl 檔案');
      if (mtlRef.current) mtlRef.current.value = '';
      return;
    }
    setUploadingSlot('mtl');
    setUploadError(null);
    try {
      const paths = await uploadFiles([file], artifact.id);
      // Clear `texture` on the same change — see spec §4: the kiosk's GLTF
      // uniform-override would otherwise overwrite the new MTL-driven
      // textures (Canvas3D.tsx:274-281).
      onChange({ ...artifact, mtl: paths[0], texture: undefined });
      await maybeRebuild();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingSlot(null);
      if (mtlRef.current) mtlRef.current.value = '';
    }
  };

  return (
    <div className="admin-section">
      <h3>古玩藏品</h3>

      <div style={{ marginBottom: 16 }}>
        <div className="admin-label">名稱</div>
        <input
          className="admin-input"
          value={artifact.title}
          placeholder="例如：青花瓷"
          onChange={(e) => onChange({ ...artifact, title: e.target.value })}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="admin-label">介紹</div>
        <textarea
          className="admin-textarea"
          value={artifact.description}
          placeholder="藏品介紹內容..."
          onChange={(e) => onChange({ ...artifact, description: e.target.value })}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="admin-label">3D 模型檔案</div>
        <FormatToggle
          idSuffix={artifact.id}
          format={format}
          hasObj={hasObj}
          hasFbx={hasFbx}
          onSwitch={switchFormat}
        />
        <div style={{ display: 'grid', gap: 10 }}>
          <UploadRow
            label={format === 'fbx' ? 'FBX 模型（必須）' : 'OBJ 模型（必須）'}
            accept={format === 'fbx' ? '.fbx' : '.obj'}
            inputRef={objRef}
            onChange={handleObj}
            uploading={uploadingSlot === 'obj'}
            currentPath={artifact.model}
            missing={isMissing(artifact.model, files)}
            onRemove={() => removeFile(artifact.model, () => ({ ...artifact, model: '' }))}
          />
          {format === 'obj' && (
            <>
              <TextureMultiRow
                inputRef={textureRef}
                onChange={handleTextures}
                uploading={uploadingSlot === 'texture'}
                rebuilding={rebuilding}
                jpegs={listJpegs(files)}
                legacyTexture={artifact.texture}
                legacyMissing={isMissing(artifact.texture, files)}
                mtlRefs={mtlRefs}
                onRemoveJpeg={async (filename) => {
                  await removeFile(`${artifact.id}/${filename}`, () => artifact);
                  await maybeRebuild();
                }}
                onRemoveLegacy={() =>
                  removeFile(artifact.texture, () => ({ ...artifact, texture: undefined }))
                }
              />
              <UploadRow
                label="MTL 材質（可選）"
                accept=".mtl"
                inputRef={mtlRef}
                onChange={handleMtl}
                uploading={uploadingSlot === 'mtl'}
                currentPath={artifact.mtl}
                missing={isMissing(artifact.mtl, files)}
                onRemove={() => removeFile(artifact.mtl, () => ({ ...artifact, mtl: undefined }))}
              />
            </>
          )}
          {uploadError && <span style={{ color: 'var(--danger)', fontSize: 13 }}>{uploadError}</span>}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <button
          className="admin-btn danger"
          onClick={() => {
            if (window.confirm(`刪除「${artifact.title || '未命名'}」？此操作會同時移除相關檔案。`)) {
              onDelete();
            }
          }}
        >
          刪除此藏品
        </button>
      </div>
    </div>
  );
}

interface UploadRowProps {
  label: string;
  accept: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  currentPath?: string;
  missing?: boolean;
  onRemove?: () => void;
}

function UploadRow({
  label,
  accept,
  inputRef,
  onChange,
  uploading,
  currentPath,
  missing,
  onRemove,
}: UploadRowProps) {
  return (
    <div className="file-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 180 }}>{label}</span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={onChange}
          style={{ color: 'var(--muted)', fontSize: 13 }}
        />
        {uploading && <span style={{ color: 'var(--amber)', fontSize: 13 }}>上傳中…</span>}
      </div>
      {currentPath && (
        <div className="file-path" style={missing ? { color: 'var(--danger)' } : undefined}>
          {missing ? '檔案遺失' : currentPath}
          {onRemove && (
            <button
              type="button"
              className="file-remove"
              onClick={onRemove}
              aria-label="移除檔案"
              title="移除檔案"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface FormatToggleProps {
  idSuffix: string;
  format: ModelFormat;
  hasObj: boolean;
  hasFbx: boolean;
  onSwitch: (target: ModelFormat) => void;
}

function FormatToggle({ idSuffix, format, hasObj, hasFbx, onSwitch }: FormatToggleProps) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="admin-radio-group">
        <label className={format === 'obj' ? 'active' : ''}>
          <input
            type="radio"
            name={`fmt-${idSuffix}`}
            checked={format === 'obj'}
            onChange={() => onSwitch('obj')}
          />
          OBJ
          {format !== 'obj' && hasObj && (
            <span style={{ marginLeft: 6, color: 'var(--amber)', fontSize: 12 }}>
              已有 OBJ 檔案
            </span>
          )}
        </label>
        <label className={format === 'fbx' ? 'active' : ''}>
          <input
            type="radio"
            name={`fmt-${idSuffix}`}
            checked={format === 'fbx'}
            onChange={() => onSwitch('fbx')}
          />
          FBX
          {format !== 'fbx' && hasFbx && (
            <span style={{ marginLeft: 6, color: 'var(--amber)', fontSize: 12 }}>
              已有 FBX 檔案
            </span>
          )}
        </label>
      </div>
      <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 4 }}>
        切換格式只會變更渲染來源，不會刪除任何已上傳檔案。
      </div>
    </div>
  );
}
