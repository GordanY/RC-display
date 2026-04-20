import { useCallback, useEffect, useState } from 'react';
import { useExhibitData } from '../hooks/useExhibitData';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import ArtifactTabs from './ArtifactTabs';
import StudentThumbs from './StudentThumbs';
import Canvas3D from './Canvas3D';
import type { Artifact, Creation } from '../types';

export default function KioskLayout() {
  const { data, loading, error } = useExhibitData();
  const [artifactId, setArtifactId] = useState<string>('');
  const [creationId, setCreationId] = useState<string | null>(null);

  const resetToDefault = useCallback(() => {
    if (data && data.artifacts.length > 0) {
      setArtifactId(data.artifacts[0].id);
      setCreationId(null);
    }
  }, [data]);

  useIdleTimeout(resetToDefault, 60_000);

  useEffect(() => {
    if (data && !artifactId && data.artifacts.length > 0) {
      setArtifactId(data.artifacts[0].id);
    }
  }, [data, artifactId]);

  if (loading) return <div className="kiosk-state">Loading…</div>;
  if (error || !data) return <div className="kiosk-state">Error: {error ?? 'unknown'}</div>;

  if (data.artifacts.length === 0) {
    return (
      <KioskFrame>
        <h1 className="exhibit-title">{data.exhibitTitle || '展覽'}</h1>
        <div className="kiosk-state" style={{ minHeight: 0, marginTop: 120 }}>
          尚未新增藏品
        </div>
      </KioskFrame>
    );
  }

  const artifact: Artifact =
    data.artifacts.find((a) => a.id === artifactId) ?? data.artifacts[0];
  const creation: Creation | null =
    creationId !== null ? artifact.creations.find((c) => c.id === creationId) ?? null : null;

  const handleArtifact = (id: string) => {
    setArtifactId(id);
    setCreationId(null);
  };
  const handleCreation = (id: string) => {
    setCreationId((prev) => (prev === id ? null : id));
  };

  const source = creation?.model ? creation : artifact;
  const modelPath = source.model || '';
  const texturePath = source.texture;
  const mtlPath = source.mtl;
  const footer = creation
    ? { name: creation.name, school: creation.school, displayMode: creation.displayMode }
    : null;

  return (
    <KioskFrame>
      <h1 className="exhibit-title">{data.exhibitTitle || '展覽'}</h1>
      <ArtifactTabs artifacts={data.artifacts} activeId={artifact.id} onSelect={handleArtifact} />
      <Canvas3D
        modelPath={modelPath}
        texturePath={texturePath}
        mtlPath={mtlPath}
        footer={footer}
      />
      <div className="section">
        <div className="section-label">學生作品</div>
        <StudentThumbs
          creations={artifact.creations}
          activeId={creationId}
          onSelect={handleCreation}
        />
      </div>
      <div className="section">
        <div className="section-label">古玩藏品介紹</div>
        <div className="description">{artifact.description || ''}</div>
      </div>
    </KioskFrame>
  );
}

function KioskFrame({ children }: { children: React.ReactNode }) {
  const [wrap, setWrap] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!wrap) return;
    const fit = () => {
      const availableH = window.innerHeight - 40;
      const availableW = window.innerWidth - 40;
      const scale = Math.min(1, availableH / 1920, availableW / 1080);
      wrap.style.transform = `scale(${scale})`;
      wrap.style.width = `${1080 * scale}px`;
      wrap.style.height = `${1920 * scale}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [wrap]);

  return (
    <div className="kiosk-page">
      <div className="kiosk-wrap" ref={setWrap}>
        <div className="kiosk">
          <div className="content">{children}</div>
        </div>
      </div>
    </div>
  );
}
