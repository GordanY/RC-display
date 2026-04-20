import { useCallback, useEffect, useState } from 'react';
import type { ExhibitData } from '../types';
import { fetchData, saveData } from './api';
import { useAutosave, type SyncStatus } from '../hooks/useAutosave';
import ArtifactList from './ArtifactList';

export default function AdminLayout() {
  const [data, setData] = useState<ExhibitData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchData()
      .then(setData)
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, []);

  const { status, errorMessage } = useAutosave<ExhibitData>({
    data,
    save: saveData,
    delayMs: 400,
  });

  const handleExhibitTitleChange = useCallback((title: string) => {
    setData((prev) => (prev ? { ...prev, exhibitTitle: title } : prev));
  }, []);

  const handleDataChange = useCallback((next: ExhibitData) => {
    setData(next);
  }, []);

  if (loadError) return <div className="kiosk-state">Error loading data: {loadError}</div>;
  if (!data) return <div className="kiosk-state">Loading…</div>;

  return (
    <div className="admin-page">
      <div className="admin-bar">
        <span className="badge">ADMIN</span>
        <SyncBadge status={status} error={errorMessage} />
        <span className="spacer" />
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          style={{
            color: 'var(--text)',
            textDecoration: 'none',
            border: '1px solid var(--border-hi)',
            padding: '6px 12px',
          }}
        >
          預覽展示
        </a>
      </div>

      <div className="admin-frame-wrap">
        <div className="admin-frame">
          <div className="content">
            <div style={{ marginBottom: 20 }}>
              <div className="admin-label">展覽名稱</div>
              <input
                className="admin-input"
                value={data.exhibitTitle}
                placeholder="例如：張宗憲先生古玩藏品"
                onChange={(e) => handleExhibitTitleChange(e.target.value)}
                style={{ fontSize: 28, fontWeight: 500 }}
              />
            </div>

            <ArtifactList data={data} onChange={handleDataChange} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SyncBadge({ status, error }: { status: SyncStatus; error: string | null }) {
  const label =
    status === 'syncing' ? '同步中…'
    : status === 'saved' ? '已同步'
    : status === 'error' ? `同步失敗${error ? ` · ${error}` : ''}`
    : '待機';
  const klass =
    status === 'syncing' ? 'sync syncing'
    : status === 'saved' ? 'sync saved'
    : status === 'error' ? 'sync error'
    : 'sync';
  return (
    <span className={klass}>
      <span className="dot" />
      <span className="text">{label}</span>
    </span>
  );
}
