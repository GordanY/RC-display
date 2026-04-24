import type { MtlTextureRef } from './mtlParse';

export interface TextureMultiRowProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  rebuilding: boolean;
  jpegs: string[];
  legacyTexture?: string;
  legacyMissing: boolean;
  mtlRefs: MtlTextureRef[];
  onRemoveJpeg: (filename: string) => void;
  onRemoveLegacy: () => void;
}

export function TextureMultiRow({
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
  const refFiles = mtlRefs.map((r) => r.file);
  const missingFromDisk = refFiles.filter((f) => !jpegs.includes(f) && !f.includes('/'));
  // Only flag "未被 MTL 引用" when an MTL actually exists; otherwise every
  // JPEG appears unreferenced and the warning is noise (the kiosk uses the
  // legacy uniform-override path in that case).
  const unreferenced = mtlRefs.length === 0 ? [] : jpegs.filter((j) => !refFiles.includes(j));
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
        <span key={`sub-${r.file}`} style={{ color: 'var(--amber)', fontSize: 12 }}>
          MTL 使用子目錄路徑（{r.file}），重新封裝模型時將自動扁平化
        </span>
      ))}
    </div>
  );
}
