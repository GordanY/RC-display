import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import type { Creation, Artifact, ContentView } from '../types';
import PhotoLightbox from './PhotoLightbox';

interface Props {
  creation: Creation;
  artifact: Artifact;
  onViewChange: (view: ContentView) => void;
}

export default function InfoView({ creation, artifact, onViewChange }: Props) {
  const { t } = useLanguage();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <div className="flex flex-col h-full">
      <h1 className="text-gold text-2xl font-bold">{t(creation.title)}</h1>
      <p className="text-gray-400 text-sm mt-1">{t(creation.artist)}</p>
      <p className="text-gray-600 text-xs mt-0.5">
        {t(artifact.name)} · {t(artifact.period)}
      </p>
      <p className="text-gray-300 text-sm mt-3 leading-relaxed flex-1 overflow-y-auto">
        {t(creation.description)}
      </p>

      {/* Photo thumbnails */}
      {creation.photos.length > 0 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
          {creation.photos.map((photo, i) => (
            <button
              key={photo}
              onClick={() => setLightboxIndex(i)}
              className="flex-shrink-0 w-20 h-16 rounded overflow-hidden border border-gray-800 min-h-[44px]"
            >
              <img
                src={`/artifacts/${photo}`}
                alt={`${t(creation.title)} ${i + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.classList.add('bg-gray-800');
                }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mt-3 pb-2">
        {(creation.model || artifact.model) && (
          <button onClick={() => onViewChange('model')} className="px-4 py-2 rounded bg-gray-900 text-gold text-sm min-h-[44px]">
            3D Model
          </button>
        )}
        <button onClick={() => onViewChange('comparison')} className="px-4 py-2 rounded bg-gray-900 text-gray-400 text-sm min-h-[44px]">
          Compare
        </button>
        {creation.video && (
          <button onClick={() => onViewChange('video')} className="px-4 py-2 rounded bg-gray-900 text-gray-400 text-sm min-h-[44px]">
            Video
          </button>
        )}
      </div>

      {/* Photo lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={creation.photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          alt={t(creation.title)}
        />
      )}
    </div>
  );
}
