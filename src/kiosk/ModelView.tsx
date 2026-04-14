import { Suspense, useRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { Group } from 'three';

interface Props {
  modelPath: string;
  onClose: () => void;
}

function RotatingModel({ path }: { path: string }) {
  const obj = useLoader(OBJLoader, path);
  const ref = useRef<Group>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.3;
    }
  });

  return <primitive ref={ref} object={obj.clone()} />;
}

export default function ModelView({ modelPath, onClose }: Props) {
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
      <p className="absolute bottom-3 left-0 right-0 text-center text-gray-600 text-xs">
        Drag to rotate · Pinch to zoom
      </p>
    </div>
  );
}
