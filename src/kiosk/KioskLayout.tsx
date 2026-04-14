import { useState, useCallback } from 'react';
import { useExhibitData } from '../hooks/useExhibitData';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { useLanguage } from '../context/LanguageContext';
import ArtifactTabs from './ArtifactTabs';
import CreationPills from './CreationPills';
import type { ContentView } from '../types';

export default function KioskLayout() {
  const { data, loading, error } = useExhibitData();
  const { language, toggleLanguage, t } = useLanguage();
  const [activeArtifactId, setActiveArtifactId] = useState<string>('');
  const [activeCreationId, setActiveCreationId] = useState<string>('');
  const [contentView, setContentView] = useState<ContentView>('info');

  const resetToDefault = useCallback(() => {
    if (data && data.artifacts.length > 0) {
      setActiveArtifactId(data.artifacts[0].id);
      setActiveCreationId(data.artifacts[0].creations[0]?.id ?? '');
      setContentView('info');
    }
  }, [data]);

  useIdleTimeout(resetToDefault, 60000);

  // Set initial selection when data loads
  if (data && !activeArtifactId && data.artifacts.length > 0) {
    setActiveArtifactId(data.artifacts[0].id);
    setActiveCreationId(data.artifacts[0].creations[0]?.id ?? '');
  }

  if (loading) {
    return <div className="bg-black h-screen flex items-center justify-center text-gold">Loading...</div>;
  }

  if (error || !data) {
    return <div className="bg-black h-screen flex items-center justify-center text-red-500">Error: {error}</div>;
  }

  const activeArtifact = data.artifacts.find(a => a.id === activeArtifactId);
  const activeCreation = activeArtifact?.creations.find(c => c.id === activeCreationId);

  const handleArtifactSelect = (id: string) => {
    setActiveArtifactId(id);
    const artifact = data.artifacts.find(a => a.id === id);
    setActiveCreationId(artifact?.creations[0]?.id ?? '');
    setContentView('info');
  };

  return (
    <div className="bg-black h-screen w-screen flex flex-col" style={{ maxWidth: 1080, maxHeight: 1920 }}>
      {/* Navigation — top */}
      <ArtifactTabs
        artifacts={data.artifacts}
        activeId={activeArtifactId}
        onSelect={handleArtifactSelect}
      />

      {activeArtifact && (
        <CreationPills
          creations={activeArtifact.creations}
          activeId={activeCreationId}
          onSelect={(id) => { setActiveCreationId(id); setContentView('info'); }}
        />
      )}

      {/* Language toggle */}
      <div className="flex justify-end px-4 py-1">
        <button
          onClick={toggleLanguage}
          className="text-xs px-3 py-1 rounded bg-gray-900 text-gold min-h-[44px] min-w-[44px]"
        >
          {language === 'zh' ? '中/EN' : 'EN/中'}
        </button>
      </div>

      {/* Content area — upper portion */}
      <div className="flex-1 overflow-hidden px-4 pb-2">
        {activeCreation && activeArtifact ? (
          <div className="text-white">
            <h1 className="text-gold text-xl font-bold">{t(activeCreation.title)}</h1>
            <p className="text-gray-400 text-sm mt-1">{t(activeCreation.artist)}</p>
            <p className="text-gray-500 text-sm mt-2 line-clamp-4">{t(activeCreation.description)}</p>
            {/* Action buttons */}
            <div className="flex gap-2 mt-4">
              {(['info', 'model', 'comparison', 'video'] as ContentView[]).map(view => (
                <button
                  key={view}
                  onClick={() => setContentView(view)}
                  className={`px-3 py-2 rounded text-xs min-h-[44px] transition-colors ${
                    contentView === view
                      ? 'bg-gold text-black'
                      : 'bg-gray-900 text-gray-400'
                  }`}
                >
                  {view === 'info' ? 'Info' : view === 'model' ? '3D Model' : view === 'comparison' ? 'Compare' : 'Video'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-gray-500">No creation selected</div>
        )}
      </div>

      {/* Lower half — pure black / transparent zone */}
      <div className="h-1/2 bg-black" />
    </div>
  );
}
