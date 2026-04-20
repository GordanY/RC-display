import type { Artifact } from '../types';

interface Props {
  artifacts: Artifact[];
  activeId: string;
  onSelect: (id: string) => void;
}

export default function ArtifactTabs({ artifacts, activeId, onSelect }: Props) {
  return (
    <div className="tabs">
      {artifacts.map((a) => (
        <button
          key={a.id}
          className={`tab${a.id === activeId ? ' active' : ''}`}
          onClick={() => onSelect(a.id)}
        >
          {a.title || '—'}
        </button>
      ))}
    </div>
  );
}
