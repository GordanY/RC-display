import { useRef, useState } from 'react';
import type { Artifact } from '../types';
import { uploadFile } from './api';

interface Props {
  artifact: Artifact;
  onChange: (artifact: Artifact) => void;
  onDelete: () => void;
}

type UploadSlot = 'obj' | 'texture' | 'mtl';

export default function ArtifactForm({ artifact, onChange, onDelete }: Props) {
  const [uploadingSlot, setUploadingSlot] = useState<UploadSlot | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const objRef = useRef<HTMLInputElement>(null);
  const textureRef = useRef<HTMLInputElement>(null);
  const mtlRef = useRef<HTMLInputElement>(null);

  const uploadSlot = async (
    slot: UploadSlot,
    file: File,
    validate: (f: File) => string | null,
    apply: (path: string) => Artifact,
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
      const path = await uploadFile(file, artifact.id);
      onChange(apply(path));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingSlot(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleObj = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadSlot(
      'obj',
      file,
      (f) => (f.name.toLowerCase().endsWith('.obj') ? null : '必須是 .obj 檔案'),
      (path) => ({ ...artifact, model: path }),
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
      (path) => ({ ...artifact, texture: path }),
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
      (path) => ({ ...artifact, mtl: path }),
      mtlRef,
    );
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
        <div style={{ display: 'grid', gap: 10 }}>
          <UploadRow
            label="OBJ 模型（必須）"
            accept=".obj"
            inputRef={objRef}
            onChange={handleObj}
            uploading={uploadingSlot === 'obj'}
            currentPath={artifact.model}
          />
          <UploadRow
            label="貼圖 JPG（若無 MTL 則必須）"
            accept=".jpg,.jpeg,image/jpeg"
            inputRef={textureRef}
            onChange={handleTexture}
            uploading={uploadingSlot === 'texture'}
            currentPath={artifact.texture}
          />
          <UploadRow
            label="MTL 材質（可選）"
            accept=".mtl"
            inputRef={mtlRef}
            onChange={handleMtl}
            uploading={uploadingSlot === 'mtl'}
            currentPath={artifact.mtl}
          />
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
