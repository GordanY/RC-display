import { useState } from 'react';

interface Props {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
  alt: string;
}

export default function PhotoLightbox({ photos, initialIndex, onClose, alt }: Props) {
  const [index, setIndex] = useState(initialIndex);

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      <button onClick={onClose} className="absolute top-4 right-4 text-white text-2xl min-h-[44px] min-w-[44px]">
        ✕
      </button>
      <img
        src={`/artifacts/${photos[index]}`}
        alt={`${alt} ${index + 1}`}
        className="max-w-full max-h-[80vh] object-contain"
        onClick={e => e.stopPropagation()}
      />
      {photos.length > 1 && (
        <div className="flex gap-4 mt-4">
          <button
            onClick={(e) => { e.stopPropagation(); setIndex(i => (i - 1 + photos.length) % photos.length); }}
            className="text-white text-xl px-4 py-2 min-h-[44px]"
          >
            ◀
          </button>
          <span className="text-gray-400 py-2">{index + 1} / {photos.length}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setIndex(i => (i + 1) % photos.length); }}
            className="text-white text-xl px-4 py-2 min-h-[44px]"
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
}
