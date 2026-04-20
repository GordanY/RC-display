import { useEffect, useRef, useState } from 'react';
import type { Creation, DisplayMode } from '../types';
import { uploadFile } from './api';

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
    uploadSlot(
      'obj',
      file,
      (f) => (f.name.toLowerCase().endsWith('.obj') ? null : '必須是 .obj 檔案'),
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
        {creation.preview && <div className="file-path">{creation.preview}</div>}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="admin-label">3D 模型檔案</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <UploadRow
            label="OBJ 模型（必須）"
            accept=".obj"
            inputRef={objRef}
            onChange={handleObj}
            uploading={uploadingSlot === 'obj'}
            currentPath={creation.model}
          />
          <UploadRow
            label="貼圖 JPG（若無 MTL 則必須）"
            accept=".jpg,.jpeg,image/jpeg"
            inputRef={textureRef}
            onChange={handleTexture}
            uploading={uploadingSlot === 'texture'}
            currentPath={creation.texture}
          />
          <UploadRow
            label="MTL 材質（可選）"
            accept=".mtl"
            inputRef={mtlRef}
            onChange={handleMtl}
            uploading={uploadingSlot === 'mtl'}
            currentPath={creation.mtl}
          />
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
}

function UploadRow({ label, accept, inputRef, onChange, uploading, currentPath }: UploadRowProps) {
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
      {currentPath && <div className="file-path">{currentPath}</div>}
    </div>
  );
}
