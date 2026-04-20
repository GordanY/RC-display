import { useEffect, useState } from 'react';
import type { ExhibitData, Artifact } from '../types';
import ArtifactForm from './ArtifactForm';
import CreationList from './CreationList';
import { deleteFile } from './api';

interface Props {
  data: ExhibitData;
  onChange: (data: ExhibitData) => void;
}

function shortId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export default function ArtifactList({ data, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(data.artifacts[0]?.id ?? null);

  useEffect(() => {
    if (selectedId && !data.artifacts.some((a) => a.id === selectedId)) {
      setSelectedId(data.artifacts[0]?.id ?? null);
    }
  }, [data.artifacts, selectedId]);

  const selected: Artifact | null =
    selectedId !== null ? data.artifacts.find((a) => a.id === selectedId) ?? null : null;

  const handleAdd = () => {
    const id = `a-${shortId()}`;
    const artifact: Artifact = {
      id,
      title: '',
      description: '',
      model: '',
      creations: [],
    };
    onChange({ ...data, artifacts: [...data.artifacts, artifact] });
    setSelectedId(id);
  };

  const handleArtifactChange = (updated: Artifact) => {
    onChange({
      ...data,
      artifacts: data.artifacts.map((a) => (a.id === updated.id ? updated : a)),
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFile(id);
    } catch (err) {
      console.error('Delete artifact files failed:', err);
    }
    onChange({
      ...data,
      artifacts: data.artifacts.filter((a) => a.id !== id),
    });
  };

  return (
    <>
      <div className="admin-row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div className="admin-tabs" style={{ flex: 1 }}>
          {data.artifacts.map((a) => (
            <button
              key={a.id}
              className={`tab${a.id === selectedId ? ' active' : ''}`}
              onClick={() => setSelectedId(a.id)}
            >
              {a.title || '未命名'}
            </button>
          ))}
        </div>
        <button className="admin-add-tile" onClick={handleAdd} title="新增古玩">
          +
        </button>
      </div>

      {selected ? (
        <>
          <ArtifactForm
            artifact={selected}
            onChange={handleArtifactChange}
            onDelete={() => handleDelete(selected.id)}
          />
          <CreationList artifact={selected} onChange={handleArtifactChange} />
        </>
      ) : (
        <div className="admin-section">
          <div style={{ color: 'var(--dim)', fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.1em' }}>
            尚未新增藏品，點擊右上方 ＋ 新增
          </div>
        </div>
      )}
    </>
  );
}
