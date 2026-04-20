import type { Creation } from '../types';

interface Props {
  creations: Creation[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export default function StudentThumbs({ creations, activeId, onSelect }: Props) {
  return (
    <div className="thumbs">
      {creations.map((c) => (
        <button
          key={c.id}
          className={`thumb${c.id === activeId ? ' active' : ''}`}
          onClick={() => onSelect(c.id)}
        >
          <div className="thumb-tile">
            {c.preview ? (
              <img src={`/artifacts/${c.preview}`} alt={c.name} />
            ) : null}
          </div>
          <span className="thumb-name">{c.name || '—'}</span>
        </button>
      ))}
    </div>
  );
}
