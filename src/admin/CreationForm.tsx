import { useEffect, useRef, useState } from 'react';
import type { Creation, DisplayMode } from '../types';
import { deleteFile, listFiles, rebuildGlb, uploadFile, uploadFiles } from './api';
import { useFileList } from '../hooks/useFileList';
import {
  detectFormat,
  hasFormat,
  hasMtl,
  isMissing,
  listTextures,
  pickSibling,
  type ModelFormat,
} from './modelFormat';
import { parseMtlTextureRefs, type MtlTextureRef } from './mtlParse';
import { TextureMultiRow } from './TextureMultiRow';

interface Props {
  creation: Creation;
  artifactId: string;
  onChange: (creation: Creation) => void;
  onDelete: () => void;
}

type UploadSlot = 'preview' | 'obj' | 'texture' | 'mtl';

export default function CreationForm({ creation, artifactId, onChange, onDelete }: Props) {
  const [uploadingSlot, setUploadingSlot] = useState<UploadSlot | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [mtlRefs, setMtlRefs] = useState<MtlTextureRef[]>([]);
  const previewRef = useRef<HTMLInputElement>(null);
  const objRef = useRef<HTMLInputElement>(null);
  const textureRef = useRef<HTMLInputElement>(null);
  const mtlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!localPreview) return;
    return () => URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  const destDir = `${artifactId}/creations/${creation.id}`;

  // Re-parse MTL whenever its path changes. Fetch is cheap; MTL is small.
  useEffect(() => {
    if (!creation.mtl) { setMtlRefs([]); return; }
    let cancelled = false;
    fetch(`/artifacts/${creation.mtl}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!cancelled) setMtlRefs(parseMtlTextureRefs(text));
      })
      .catch(() => { if (!cancelled) setMtlRefs([]); });
    return () => { cancelled = true; };
  }, [creation.mtl]);

  const files = useFileList(destDir);
  // See ArtifactForm for rationale on useState-backed format.
  const [format, setFormat] = useState<ModelFormat>(detectFormat(creation.model));
  const hasObj = hasFormat(files, 'obj');
  const hasFbx = hasFormat(files, 'fbx');

  const switchFormat = (target: ModelFormat) => {
    if (target === format) return;
    setFormat(target);
    const sibling = pickSibling(files, target);
    const nextModel = sibling ? `${destDir}/${sibling}` : '';
    onChange({ ...creation, model: nextModel });
  };

  // See ArtifactForm.removeFile — best-effort file delete + field clear.
  const removeFile = async (path: string | undefined, clear: () => Creation) => {
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

  const uploadSlot = async (
    slot: UploadSlot,
    file: File,
    validate: (f: File) => string | null,
    apply: (path: string) => Creation,
    inputRef: React.RefObject<HTMLInputElement | null>,
  ) => {
    const err = validate(file);
    if (err) {
      setUploadError(err);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setUploadingSlot(slot);
    setUploadError(null);
    try {
      const path = await uploadFile(file, destDir);
      onChange(apply(path));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingSlot(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  // Fires a GLB rebuild iff both OBJ and MTL are on disk for this creation.
  // Re-queries listFiles so a JUST-uploaded sidecar is visible (the polled
  // `files` state lags upload completion by up to 1s).
  const maybeRebuild = async () => {
    let live: string[];
    try {
      live = await listFiles(destDir);
    } catch {
      return;
    }
    if (!live.some((f) => /\.mtl$/i.test(f))) return;
    const objName = live.find((f) => /\.obj$/i.test(f));
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

  const handlePreviewUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalPreview(URL.createObjectURL(file));
    uploadSlot(
      'preview',
      file,
      () => null,
      (path) => ({ ...creation, preview: path }),
      previewRef,
    );
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
      const paths = await uploadFiles([file], destDir);
      const preferred = file.name.toLowerCase().endsWith('.obj')
        ? paths.find((p) => p.toLowerCase().endsWith('.glb')) ?? paths[0]
        : paths[0];
      onChange({ ...creation, model: preferred });
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
      if (!/\.(jpe?g|png)$/i.test(f.name)) {
        setUploadError(`必須是 .jpg 或 .png 貼圖檔案：${f.name}`);
        if (textureRef.current) textureRef.current.value = '';
        return;
      }
    }
    setUploadingSlot('texture');
    setUploadError(null);
    try {
      const paths = await uploadFiles(selected, destDir);
      const mtlPresent = hasMtl(files) || Boolean(creation.mtl);
      if (mtlPresent) {
        onChange({ ...creation, texture: undefined });
        await maybeRebuild();
      } else {
        onChange({ ...creation, texture: paths[0] });
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
      const paths = await uploadFiles([file], destDir);
      onChange({ ...creation, mtl: paths[0], texture: undefined });
      await maybeRebuild();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingSlot(null);
      if (mtlRef.current) mtlRef.current.value = '';
    }
  };

  const setDisplayMode = (mode: DisplayMode) => onChange({ ...creation, displayMode: mode });

  return (
    <div className="admin-section">
      <h3>學生作品</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <div className="admin-label">學生姓名</div>
          <input
            className="admin-input"
            value={creation.name}
            placeholder="例如：李小明"
            onChange={(e) => onChange({ ...creation, name: e.target.value })}
          />
        </div>
        <div>
          <div className="admin-label">學校</div>
          <input
            className="admin-input"
            value={creation.school}
            placeholder="例如：聖保羅書院"
            onChange={(e) => onChange({ ...creation, school: e.target.value })}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="admin-label">顯示方式（右下角）</div>
        <div className="admin-radio-group">
          <label className={creation.displayMode === 'name-school' ? 'active' : ''}>
            <input
              type="radio"
              name={`dm-${creation.id}`}
              checked={creation.displayMode === 'name-school'}
              onChange={() => setDisplayMode('name-school')}
            />
            姓名（大）／學校（小）
          </label>
          <label className={creation.displayMode === 'school-name' ? 'active' : ''}>
            <input
              type="radio"
              name={`dm-${creation.id}`}
              checked={creation.displayMode === 'school-name'}
              onChange={() => setDisplayMode('school-name')}
            />
            學校（大）／姓名（小）
          </label>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="admin-label">縮圖（預覽圖片）</div>
        <div className="file-row">
          {localPreview || creation.preview ? (
            <img
              className="preview-thumb"
              src={localPreview ?? `/artifacts/${creation.preview}`}
              alt=""
            />
          ) : (
            <div className="preview-thumb" />
          )}
          <input
            ref={previewRef}
            type="file"
            accept="image/*"
            onChange={handlePreviewUpload}
            style={{ color: 'var(--muted)', fontSize: 13 }}
          />
          {uploadingSlot === 'preview' && <span style={{ color: 'var(--amber)', fontSize: 13 }}>上傳中…</span>}
        </div>
        {creation.preview && (
          <div
            className="file-path"
            style={isMissing(creation.preview, files) ? { color: 'var(--danger)' } : undefined}
          >
            {isMissing(creation.preview, files) ? '檔案遺失' : creation.preview}
            <button
              type="button"
              className="file-remove"
              onClick={() => removeFile(creation.preview, () => ({ ...creation, preview: '' }))}
              aria-label="移除檔案"
              title="移除檔案"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="admin-label">3D 模型檔案</div>
        <FormatToggle
          idSuffix={creation.id}
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
            currentPath={creation.model}
            missing={isMissing(creation.model, files)}
            onRemove={() => removeFile(creation.model, () => ({ ...creation, model: '' }))}
          />
          {format === 'obj' && (
            <>
              <TextureMultiRow
                inputRef={textureRef}
                onChange={handleTextures}
                uploading={uploadingSlot === 'texture'}
                rebuilding={rebuilding}
                textures={listTextures(files)}
                legacyTexture={creation.texture}
                legacyMissing={isMissing(creation.texture, files)}
                mtlRefs={mtlRefs}
                onRemoveTexture={async (filename) => {
                  await removeFile(`${destDir}/${filename}`, () => creation);
                  await maybeRebuild();
                }}
                onRemoveLegacy={() =>
                  removeFile(creation.texture, () => ({ ...creation, texture: undefined }))
                }
              />
              <UploadRow
                label="MTL 材質（可選）"
                accept=".mtl"
                inputRef={mtlRef}
                onChange={handleMtl}
                uploading={uploadingSlot === 'mtl'}
                currentPath={creation.mtl}
                missing={isMissing(creation.mtl, files)}
                onRemove={() => removeFile(creation.mtl, () => ({ ...creation, mtl: undefined }))}
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
            if (window.confirm(`刪除「${creation.name || '未命名'}」的作品？此操作會同時移除相關檔案。`)) {
              onDelete();
            }
          }}
        >
          刪除此學生作品
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
