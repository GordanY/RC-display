import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  Box3,
  MeshStandardMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Group,
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

// Cache parsed models keyed by their full (path, mtl, texture) tuple. Parsing a
// 129 MB OBJ takes several seconds on the main thread, so paying it once per
// session and then clone()-ing for every subsequent view is the single biggest
// win for nav-back latency. Clones share geometry/material by default, so we
// must never dispose those resources — they belong to the cache.
const modelCache = new Map<string, Promise<Group>>();

function modelCacheKey(path: string, mtlPath?: string, texturePath?: string): string {
  return `${path}|${mtlPath ?? ''}|${texturePath ?? ''}`;
}

async function loadModel(
  path: string,
  mtlPath: string | undefined,
  texturePath: string | undefined,
): Promise<Group> {
  const explicitMtlUrl = mtlPath ? `/artifacts/${mtlPath}` : null;
  const objLoader = new OBJLoader();

  // Kick off OBJ + (known) MTL fetches in parallel. The embedded-`mtllib`
  // case still has to wait for OBJ text before we know which MTL to fetch.
  const objTextPromise = fetch(path).then(async (res) => {
    if (!res.ok) throw new Error(`Failed to fetch model: ${res.status}`);
    return res.text();
  });

  const explicitMtlPromise: Promise<{ text: string; url: string } | null> = explicitMtlUrl
    ? fetch(explicitMtlUrl)
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return { text: await res.text(), url: explicitMtlUrl };
        })
        .catch((err) => {
          console.warn(`MTL failed to load: ${explicitMtlUrl}.`, err);
          return null;
        })
    : Promise.resolve(null);

  const [objText, explicitMtl] = await Promise.all([objTextPromise, explicitMtlPromise]);

  let resolvedMtl = explicitMtl;
  if (!resolvedMtl && !explicitMtlUrl) {
    const embeddedName = objText.match(/^mtllib\s+(.+)$/m)?.[1]?.trim();
    if (embeddedName) {
      const basePath = path.substring(0, path.lastIndexOf('/') + 1);
      const embeddedUrl = basePath + embeddedName;
      try {
        const mtlRes = await fetch(embeddedUrl);
        if (!mtlRes.ok) throw new Error(`HTTP ${mtlRes.status}`);
        resolvedMtl = { text: await mtlRes.text(), url: embeddedUrl };
      } catch (mtlErr) {
        console.warn(`MTL failed to load: ${embeddedUrl}. Falling back to texture/plain.`, mtlErr);
      }
    }
  }

  let mtlLoaded = false;
  if (resolvedMtl) {
    // Vite dev server returns index.html for missing public assets. MTLLoader
    // would otherwise "succeed" parsing HTML into empty materials.
    if (resolvedMtl.text.trimStart().startsWith('<')) {
      console.warn(`MTL appears to be HTML (missing file?): ${resolvedMtl.url}`);
    } else {
      const mtlBase = resolvedMtl.url.substring(0, resolvedMtl.url.lastIndexOf('/') + 1);
      const materials = new MTLLoader().setResourcePath(mtlBase).parse(resolvedMtl.text, mtlBase);
      materials.preload();
      objLoader.setMaterials(materials);
      mtlLoaded = true;
    }
  }

  const parsed = objLoader.parse(objText);

  if (!mtlLoaded && texturePath) {
    try {
      // OBJ geometry uses OBJ/three.js UV convention: flipY = true.
      await applyTextureToGroup(parsed, `/artifacts/${texturePath}`, true);
    } catch (texErr) {
      console.warn(`Texture failed to load: ${texturePath}`, texErr);
    }
  }

  normalizeModel(parsed);
  return parsed;
}

function getOrLoadModel(
  path: string,
  mtlPath: string | undefined,
  texturePath: string | undefined,
): Promise<Group> {
  const key = modelCacheKey(path, mtlPath, texturePath);
  let cached = modelCache.get(key);
  if (!cached) {
    cached = loadModel(path, mtlPath, texturePath);
    // Evict failed loads so a later navigation can retry.
    cached.catch(() => modelCache.delete(key));
    modelCache.set(key, cached);
  }
  return cached;
}

// FBX is binary, embeds materials/textures, and parses from an ArrayBuffer.
// FBXLoader returns a Group, so it slots into the same cache/clone pipeline
// as OBJ — just via a separate cache keyspace so the texture-override branch
// can still apply when callers provide one.
const fbxCache = new Map<string, Promise<Group>>();

async function loadFbxModel(
  path: string,
  texturePath: string | undefined,
): Promise<Group> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch FBX: ${res.status}`);
  const buf = await res.arrayBuffer();
  const basePath = path.substring(0, path.lastIndexOf('/') + 1);
  const parsed = new FBXLoader().parse(buf, basePath);
  if (texturePath) {
    try {
      // FBX uses top-left UV origin like glTF, so flipY=false.
      await applyTextureToGroup(parsed as unknown as Group, `/artifacts/${texturePath}`, false);
    } catch (texErr) {
      console.warn(`FBX texture override failed: ${texturePath}`, texErr);
    }
  }
  normalizeModel(parsed as unknown as Group);
  return parsed as unknown as Group;
}

function getOrLoadFbxModel(path: string, texturePath: string | undefined): Promise<Group> {
  const key = `${path}|${texturePath ?? ''}`;
  let cached = fbxCache.get(key);
  if (!cached) {
    cached = loadFbxModel(path, texturePath);
    cached.catch(() => fbxCache.delete(key));
    fbxCache.set(key, cached);
  }
  return cached;
}

function smoothMeshGeometry(group: Group): void {
  // mergeVertices unifies vertices that share the same position AND all other
  // attributes (UV, color, etc). That preserves UV seams while deduping the
  // many per-face copies obj2gltf writes, so computeVertexNormals can then
  // generate smooth shading across coplanar triangles.
  group.traverse((child) => {
    const mesh = child as Mesh;
    if ((mesh as unknown as { isMesh?: boolean }).isMesh && mesh.geometry) {
      const original = mesh.geometry;
      try {
        const merged = mergeVertices(original);
        merged.computeVertexNormals();
        mesh.geometry = merged;
        original.dispose();
      } catch (err) {
        console.warn('smoothMeshGeometry failed; keeping original normals', err);
      }
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

// flipY=true matches OBJ/three.js convention (V origin at bottom-left);
// flipY=false matches glTF convention (V origin at top-left). Callers must
// pass the right value for the geometry's source format, or textures come out
// vertically flipped on the mesh.
function applyTextureToGroup(
  group: Group,
  textureUrl: string,
  flipY: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    new TextureLoader().load(
      textureUrl,
      (tex) => {
        tex.colorSpace = SRGBColorSpace;
        tex.flipY = flipY;
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

// Dispatcher: picks the loader by file extension.
// .glb / .gltf → GLTF path (fast, binary, async off-main-thread fetch)
// .fbx         → FBX path (binary; embeds materials/textures, no sidecars)
// anything else (.obj) → original OBJ path, kept intact for rollback. To roll
// back, edit data.json to reference the .obj sibling again — no code change.
function RotatingModel(props: {
  path: string;
  texturePath?: string;
  mtlPath?: string;
  rotating: boolean;
  modelRef: RefObject<Group | null>;
}) {
  if (/\.(glb|gltf)$/i.test(props.path)) return <GLTFRotatingModel {...props} />;
  if (/\.fbx$/i.test(props.path)) return <FBXRotatingModel {...props} />;
  return <OBJRotatingModel {...props} />;
}

function GLTFRotatingModel({
  path,
  texturePath,
  rotating,
  modelRef,
}: {
  path: string;
  texturePath?: string;
  rotating: boolean;
  modelRef: RefObject<Group | null>;
}) {
  // useGLTF throws during load; the parent <Suspense> handles the fallback.
  // drei's loader internally caches by URL, so repeat mounts are free.
  const gltf = useGLTF(path);

  const scene = useMemo(() => {
    // Clone so each mount has its own transform (rotation, reset) while
    // geometry/material stay shared with drei's cache.
    const cloned = gltf.scene.clone(true);
    // obj2gltf writes per-face (flat) normals — visible as blocky faceting on
    // meshes that looked smooth under OBJLoader, which auto-welds vertices and
    // computes smooth normals. Redo that pass here so GLB fidelity matches OBJ.
    smoothMeshGeometry(cloned);
    // Many student-creation OBJs were converted without a valid MTL, so their
    // GLBs have a default (un-textured) material. When data.json provides a
    // `texture` override, apply it to every mesh — same behaviour as the OBJ
    // path's fallback. Async; the model renders un-textured first, then
    // updates once the JPEG decodes.
    if (texturePath) {
      applyTextureToGroup(cloned, `/artifacts/${texturePath}`, false).catch((err) => {
        console.warn(`GLB texture override failed: ${texturePath}`, err);
      });
    }
    normalizeModel(cloned);
    return cloned;
  }, [gltf.scene, texturePath]);

  useFrame((_, delta) => {
    if (rotating && modelRef.current) {
      modelRef.current.rotation.y += delta * 0.3;
    }
  });

  return <primitive ref={modelRef} object={scene} />;
}

function FBXRotatingModel({
  path,
  texturePath,
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
    getOrLoadFbxModel(path, texturePath)
      .then((original) => {
        if (aborted) return;
        // Clone like the OBJ path: per-mount transform, shared geometry.
        // Skip smoothMeshGeometry — FBX from DCC tools carries authored
        // smoothing groups, and mergeVertices can corrupt skinned attrs.
        setScene(original.clone(true));
      })
      .catch((err) => {
        if (!aborted) setLoadError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      aborted = true;
      setScene(null);
    };
  }, [path, texturePath]);

  useFrame((_, delta) => {
    if (rotating && modelRef.current) {
      modelRef.current.rotation.y += delta * 0.3;
    }
  });

  if (loadError) throw loadError;
  if (!scene) return null;
  return <primitive ref={modelRef} object={scene} />;
}

function OBJRotatingModel({
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

    getOrLoadModel(path, mtlPath, texturePath)
      .then((original) => {
        if (aborted) return;
        // Clone so each mount owns its own transform (rotation state, reset
        // view) while geometry/material stay shared with the cache entry.
        setScene(original.clone(true));
      })
      .catch((err) => {
        if (!aborted) setLoadError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      aborted = true;
      // Drop the cloned wrapper only — geometry/material belong to the module
      // cache, disposing them would break the next clone.
      setScene(null);
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

function CanvasLoading() {
  // Rendered inside <Canvas> via drei's <Html> — the kiosk shows this while
  // useGLTF / OBJLoader is still resolving, so a slow first-view no longer
  // looks like a broken blank canvas.
  return (
    <Html center>
      <div
        style={{
          color: 'var(--dim)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          opacity: 0.7,
        }}
      >
        Loading…
      </div>
    </Html>
  );
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
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSceneError(false);
    setRotating(true);
  }, [modelPath, texturePath, mtlPath]);

  // Fast one-finger swipes on capacitive touchscreens often emit a ghost
  // second pointer right next to the real one. OrbitControls then switches to
  // DOLLY_PAN and, because handleTouchStartDolly records the tiny initial
  // separation as `dollyStart`, the next move computes a huge zoom ratio.
  // We swallow pointerdowns that land within GHOST_SEP_PX of a live touch
  // pointer (capture phase, so OrbitControls' target-phase listener never
  // sees them). Real two-finger pinches start with the fingers clearly apart
  // and pass through untouched.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const GHOST_SEP_PX = 60;
    const live = new Map<number, { x: number; y: number }>();
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      for (const p of live.values()) {
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < GHOST_SEP_PX) {
          e.stopPropagation();
          return;
        }
      }
      live.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const onMove = (e: PointerEvent) => {
      const p = live.get(e.pointerId);
      if (p) { p.x = e.clientX; p.y = e.clientY; }
    };
    const onEnd = (e: PointerEvent) => {
      live.delete(e.pointerId);
    };
    el.addEventListener('pointerdown', onDown, { capture: true });
    el.addEventListener('pointermove', onMove, { capture: true });
    el.addEventListener('pointerup', onEnd, { capture: true });
    el.addEventListener('pointercancel', onEnd, { capture: true });
    return () => {
      el.removeEventListener('pointerdown', onDown, { capture: true });
      el.removeEventListener('pointermove', onMove, { capture: true });
      el.removeEventListener('pointerup', onEnd, { capture: true });
      el.removeEventListener('pointercancel', onEnd, { capture: true });
    };
  }, []);

  const hasModel = modelPath.trim().length > 0;

  const handleReset = () => {
    if (modelRef.current) {
      modelRef.current.rotation.set(0, 0, 0);
    }
    controlsRef.current?.reset();
    setRotating(true);
  };

  return (
    <div className="canvas" ref={wrapRef}>
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
            <Suspense fallback={<CanvasLoading />}>
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
