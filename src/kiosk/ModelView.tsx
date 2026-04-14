import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import type { Group, BufferGeometry, Material } from 'three';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  modelPath: string;
  onClose: () => void;
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

function RotatingModel({ path }: { path: string }) {
  const [scene, setScene] = useState<Group | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const ref = useRef<Group>(null);

  useEffect(() => {
    let aborted = false;

    (async () => {
      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`Failed to fetch model: ${res.status}`);
        const objText = await res.text();

        const basePath = path.substring(0, path.lastIndexOf('/') + 1);
        const mtlMatch = objText.match(/^mtllib\s+(.+)$/m);

        const objLoader = new OBJLoader();

        if (mtlMatch) {
          const mtlFilename = mtlMatch[1].trim();
          try {
            const mtlLoader = new MTLLoader();
            const materials = await mtlLoader.loadAsync(basePath + mtlFilename);
            materials.preload();
            objLoader.setMaterials(materials);
          } catch {
            console.warn(`MTL file not found or failed to load: ${mtlFilename}. Rendering without materials.`);
          }
        }

        const parsed = objLoader.parse(objText);
        if (!aborted) setScene(parsed);
      } catch (err) {
        if (!aborted) setLoadError(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return () => {
      aborted = true;
      setScene((prev) => { if (prev) disposeGroup(prev); return null; });
    };
  }, [path]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.3;
    }
  });

  if (loadError) throw loadError;
  if (!scene) return null;

  return <primitive ref={ref} object={scene} />;
}

function ModelError() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <p className="text-gray-500 text-sm">Failed to load 3D model</p>
    </div>
  );
}

export default function ModelView({ modelPath, onClose }: Props) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="relative h-full w-full bg-black">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 text-gray-400 bg-black/80 px-3 py-1 rounded min-h-[44px] min-w-[44px]"
        >
          ✕
        </button>
        <ModelError />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-2 left-2 z-10 text-gold text-xs bg-black/80 px-2 py-1 rounded">
        3D Model
      </div>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-10 text-gray-400 bg-black/80 px-3 py-1 rounded min-h-[44px] min-w-[44px]"
      >
        ✕
      </button>
      <ErrorBoundary onError={() => setError(true)}>
        <Canvas
          camera={{ position: [0, 0, 3], fov: 50 }}
          style={{ background: '#000000' }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <Suspense fallback={null}>
            <RotatingModel path={`/artifacts/${modelPath}`} />
          </Suspense>
          <OrbitControls
            enableDamping
            dampingFactor={0.1}
            enableZoom
            enablePan={false}
          />
        </Canvas>
      </ErrorBoundary>
      <p className="absolute bottom-3 left-0 right-0 text-center text-gray-600 text-xs">
        Drag to rotate · Pinch to zoom
      </p>
    </div>
  );
}
