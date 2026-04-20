import { useEffect, useState } from 'react';
import type { Artifact, Creation } from '../types';
import CreationForm from './CreationForm';
import { deleteFile } from './api';

interface Props {
  artifact: Artifact;
  onChange: (artifact: Artifact) => void;
}

function shortId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export default function CreationList({ artifact, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    artifact.creations[0]?.id ?? null,
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLButtonElement>, id: string) => {
    if (!draggingId || draggingId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overId !== id) setOverId(id);
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>, targetId: string) => {
    e.preventDefault();
    const sourceId = draggingId ?? e.dataTransfer.getData('text/plain');
    setDraggingId(null);
    setOverId(null);
    if (!sourceId || sourceId === targetId) return;
    const list = artifact.creations;
    const from = list.findIndex((c) => c.id === sourceId);
    const to = list.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) return;
    const next = list.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange({ ...artifact, creations: next });
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setOverId(null);
  };

  useEffect(() => {
    if (selectedId && !artifact.creations.some((c) => c.id === selectedId)) {
      setSelectedId(artifact.creations[0]?.id ?? null);
    }
  }, [artifact.creations, selectedId]);

  const selected: Creation | null =
    selectedId !== null ? artifact.creations.find((c) => c.id === selectedId) ?? null : null;

  const handleAdd = () => {
    const id = `c-${shortId()}`;
    const creation: Creation = {
      id,
      name: '',
      school: '',
      displayMode: 'name-school',
      preview: '',
      model: '',
    };
    onChange({ ...artifact, creations: [...artifact.creations, creation] });
    setSelectedId(id);
  };

  const handleCreationChange = (updated: Creation) => {
    onChange({
      ...artifact,
      creations: artifact.creations.map((c) => (c.id === updated.id ? updated : c)),
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFile(`${artifact.id}/creations/${id}`);
    } catch (err) {
      console.error('Delete creation files failed:', err);
    }
    onChange({
      ...artifact,
      creations: artifact.creations.filter((c) => c.id !== id),
    });
  };

  return (
    <div className="admin-section" style={{ marginTop: 20 }}>
      <h3>學生作品列表</h3>

      <div className="thumbs" style={{ marginBottom: 16 }}>
        {artifact.creations.map((c) => {
          const classes = ['thumb'];
          if (c.id === selectedId) classes.push('active');
          if (c.id === draggingId) classes.push('dragging');
          if (c.id === overId) classes.push('drop-target');
          return (
            <button
              key={c.id}
              className={classes.join(' ')}
              onClick={() => setSelectedId(c.id)}
              draggable
              onDragStart={(e) => handleDragStart(e, c.id)}
              onDragOver={(e) => handleDragOver(e, c.id)}
              onDragLeave={() => overId === c.id && setOverId(null)}
              onDrop={(e) => handleDrop(e, c.id)}
              onDragEnd={handleDragEnd}
            >
              <div className="thumb-tile">
                {c.preview ? <img src={`/artifacts/${c.preview}`} alt={c.name} /> : null}
              </div>
              <span className="thumb-name">{c.name || '未命名'}</span>
            </button>
          );
        })}
        <button
          className="admin-add-tile"
          style={{ width: 168, height: 128 }}
          onClick={handleAdd}
          title="新增學生作品"
        >
          +
        </button>
      </div>

      {selected ? (
        <CreationForm
          key={selected.id}
          creation={selected}
          artifactId={artifact.id}
          onChange={handleCreationChange}
          onDelete={() => handleDelete(selected.id)}
        />
      ) : (
        <div style={{ color: 'var(--dim)', fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.1em' }}>
          尚未新增學生作品
        </div>
      )}
    </div>
  );
}
