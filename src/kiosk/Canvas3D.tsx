import { Suspense, useEffect, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import {
  Box3,
  MeshStandardMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type BufferGeometry,
  type Group,
  type Material,
  type Mesh,
} from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ErrorBoundary } from './ErrorBoundary';
import type { DisplayMode } from '../types';

interface Props {
  modelPath: string;
  texturePath?: string;
  mtlPath?: string;
  footer: { name: string; school: string; displayMode: DisplayMode } | null;
}

function disposeGroup(group: Group) {
  group.traverse((child) => {
    const mesh = child as { geometry?: BufferGeometry; material?: Material | Material[] };
    mesh.geometry?.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    } else {
      mesh.material?.dispose();
    }
  });
}

function normalizeModel(group: Group): void {
  const bbox = new Box3().setFromObject(group);
  const size = bbox.getSize(new Vector3());
  const center = bbox.getCenter(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!isFinite(maxDim) || maxDim <= 0) return;
  const scale = 2 / maxDim;
  group.position.sub(center.multiplyScalar(scale));
  group.scale.setScalar(scale);
}

function applyTextureToGroup(group: Group, textureUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    new TextureLoader().load(
      textureUrl,
      (tex) => {
        tex.colorSpace = SRGBColorSpace;
        group.traverse((child) => {
          const maybeMesh = child as Mesh;
          if ((maybeMesh as unknown as { isMesh?: boolean }).isMesh) {
            maybeMesh.material = new MeshStandardMaterial({ map: tex });
          }
        });
        resolve();
      },
      undefined,
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    );
  });
}

function RotatingModel({
  path,
  texturePath,
  mtlPath,
  rotating,
  modelRef,
}: {
  path: string;
  texturePath?: string;
  mtlPath?: string;
  rotating: boolean;
  modelRef: RefObject<Group | null>;
}) {
  const [scene, setScene] = useState<Group | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    let aborted = false;

    (async () => {
      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`Failed to fetch model: ${res.status}`);
        const objText = await res.text();

        const basePath = path.substring(0, path.lastIndexOf('/') + 1);
        const objLoader = new OBJLoader();

        const explicitMtlUrl = mtlPath ? `/artifacts/${mtlPath}` : null;
        const embeddedMtlName = objText.match(/^mtllib\s+(.+)$/m)?.[1]?.trim() ?? null;
        const mtlUrl = explicitMtlUrl ?? (embeddedMtlName ? basePath + embeddedMtlName : null);

        let mtlLoaded = false;
        if (mtlUrl) {
          try {
            const mtlRes = await fetch(mtlUrl);
            if (!mtlRes.ok) throw new Error(`HTTP ${mtlRes.status}`);
            const mtlText = await mtlRes.text();
            // Vite dev server returns index.html for missing public assets.
            // MTLLoader would otherwise "succeed" parsing HTML into empty materials.
            if (mtlText.trimStart().startsWith('<')) throw new Error('Not an MTL file');
            const mtlBase = mtlUrl.substring(0, mtlUrl.lastIndexOf('/') + 1);
            const materials = new MTLLoader().setResourcePath(mtlBase).parse(mtlText, mtlBase);
            materials.preload();
            objLoader.setMaterials(materials);
            mtlLoaded = true;
          } catch (mtlErr) {
            console.warn(`MTL failed to load: ${mtlUrl}. Falling back to texture/plain.`, mtlErr);
          }
        }

        const parsed = objLoader.parse(objText);

        if (!mtlLoaded && texturePath) {
          try {
            await applyTextureToGroup(parsed, `/artifacts/${texturePath}`);
          } catch (texErr) {
            console.warn(`Texture failed to load: ${texturePath}`, texErr);
          }
        }

        normalizeModel(parsed);

        if (!aborted) setScene(parsed);
      } catch (err) {
        if (!aborted) setLoadError(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return () => {
      aborted = true;
      setScene((prev) => {
        if (prev) disposeGroup(prev);
        return null;
      });
    };
  }, [path, texturePath, mtlPath]);

  useFrame((_, delta) => {
    if (rotating && modelRef.current) {
      modelRef.current.rotation.y += delta * 0.3;
    }
  });

  if (loadError) throw loadError;
  if (!scene) return null;

  return <primitive ref={modelRef} object={scene} />;
}

function EmptyCanvas({ label }: { label: string }) {
  return (
    <div className="canvas-inner">
      <div style={{ color: 'var(--dim)', fontFamily: 'var(--font-mono)', fontSize: 14, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

function IconStop() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M5 3.5v9l7.5-4.5z" fill="currentColor" />
    </svg>
  );
}

function IconReset() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M3.5 8a4.5 4.5 0 1 0 1.32-3.18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M3 2.5V5h2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CanvasTools({
  rotating,
  onToggleRotate,
  onReset,
}: {
  rotating: boolean;
  onToggleRotate: () => void;
  onReset: () => void;
}) {
  return (
    <div className="canvas-tools">
      <button
        type="button"
        className="canvas-tool"
        onClick={onToggleRotate}
        aria-label={rotating ? 'Stop rotating' : 'Start rotating'}
        title={rotating ? 'Stop rotating' : 'Start rotating'}
      >
        {rotating ? <IconStop /> : <IconPlay />}
      </button>
      <button
        type="button"
        className="canvas-tool"
        onClick={onReset}
        aria-label="Reset view"
        title="Reset view"
      >
        <IconReset />
      </button>
    </div>
  );
}

function FooterOverlay({ footer }: { footer: Props['footer'] }) {
  if (!footer) return <div className="canvas-footer hidden" />;
  const primary = footer.displayMode === 'name-school' ? footer.name : footer.school;
  const secondary = footer.displayMode === 'name-school' ? footer.school : footer.name;
  return (
    <div className="canvas-footer">
      <div className="primary">{primary || '—'}</div>
      <div className="secondary">{secondary || '—'}</div>
    </div>
  );
}

export default function Canvas3D({ modelPath, texturePath, mtlPath, footer }: Props) {
  const [sceneError, setSceneError] = useState(false);
  const [rotating, setRotating] = useState(true);
  const modelRef = useRef<Group | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    setSceneError(false);
    setRotating(true);
  }, [modelPath, texturePath, mtlPath]);

  const hasModel = modelPath.trim().length > 0;

  const handleReset = () => {
    if (modelRef.current) {
      modelRef.current.rotation.set(0, 0, 0);
    }
    controlsRef.current?.reset();
    setRotating(true);
  };

  return (
    <div className="canvas">
      {!hasModel && <EmptyCanvas label="NO MODEL" />}
      {hasModel && sceneError && <EmptyCanvas label="MODEL FAILED TO LOAD" />}
      {hasModel && !sceneError && (
        <ErrorBoundary onError={() => setSceneError(true)}>
          <Canvas
            camera={{ position: [0, 0, 3], fov: 50 }}
            style={{ background: 'transparent' }}
          >
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            <Suspense fallback={null}>
              <RotatingModel
                path={`/artifacts/${modelPath}`}
                texturePath={texturePath}
                mtlPath={mtlPath}
                rotating={rotating}
                modelRef={modelRef}
              />
            </Suspense>
            <OrbitControls
              ref={controlsRef}
              enableDamping
              dampingFactor={0.1}
              enableZoom
              enablePan={false}
            />
          </Canvas>
          <CanvasTools
            rotating={rotating}
            onToggleRotate={() => setRotating((r) => !r)}
            onReset={handleReset}
          />
        </ErrorBoundary>
      )}
      <FooterOverlay footer={footer} />
    </div>
  );
}
