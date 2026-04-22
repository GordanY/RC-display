import { useEffect, useRef, useState } from 'react';
import type { Creation, DisplayMode } from '../types';
import { deleteFile, uploadFile } from './api';
import { useFileList } from '../hooks/useFileList';
import {
  detectFormat,
  hasFormat,
  isMissing,
  pickSibling,
  type ModelFormat,
} from './modelFormat';

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
  const previewRef = useRef<HTMLInputElement>(null);
  const objRef = useRef<HTMLInputElement>(null);
  const textureRef = useRef<HTMLInputElement>(null);
  const mtlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!localPreview) return;
    return () => URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  const destDir = `${artifactId}/creations/${creation.id}`;

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

  const handleObj = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const expected = format === 'fbx' ? '.fbx' : '.obj';
    uploadSlot(
      'obj',
      file,
      (f) => (f.name.toLowerCase().endsWith(expected) ? null : `必須是 ${expected} 檔案`),
      (path) => ({ ...creation, model: path }),
      objRef,
    );
  };

  const handleTexture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadSlot(
      'texture',
      file,
      (f) => {
        const n = f.name.toLowerCase();
        return n.endsWith('.jpg') || n.endsWith('.jpeg') ? null : '必須是 .jpg 貼圖檔案';
      },
      (path) => ({ ...creation, texture: path }),
      textureRef,
    );
  };

  const handleMtl = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadSlot(
      'mtl',
      file,
      (f) => (f.name.toLowerCase().endsWith('.mtl') ? null : '必須是 .mtl 檔案'),
      (path) => ({ ...creation, mtl: path }),
      mtlRef,
    );
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
              <UploadRow
                label="貼圖 JPG（若無 MTL 則必須）"
                accept=".jpg,.jpeg,image/jpeg"
                inputRef={textureRef}
                onChange={handleTexture}
                uploading={uploadingSlot === 'texture'}
                currentPath={creation.texture}
                missing={isMissing(creation.texture, files)}
                onRemove={() => removeFile(creation.texture, () => ({ ...creation, texture: undefined }))}
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
