'use client';

import * as THREE from 'three';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber';
import NextImage from 'next/image';
import SceneReady from './SceneReady';
import {
  Image as SceneImage,
  MeshTransmissionMaterial,
  Preload,
  Scroll,
  ScrollControls,
  useFBO,
  useGLTF,
  useScroll,
} from '@react-three/drei';
import type { GLTF } from 'three-stdlib';

type LensModel = GLTF & {
  nodes: {
    Cylinder: THREE.Mesh;
  };
};

type PanelProps = {
  url: string;
  position: [number, number, number];
  scale: [number, number];
  start: number;
  zoom?: number;
  reducedMotion?: boolean;
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return reduced;
}

function Lens({ children, reducedMotion }: { children: React.ReactNode; reducedMotion: boolean }) {
  const lens = useRef<THREE.Mesh>(null!);
  const { nodes } = useGLTF('/lens-transformed.glb') as unknown as LensModel;
  const buffer = useFBO({ samples: 0 });
  const viewport = useThree((state) => state.viewport);
  const [scene] = useState(() => new THREE.Scene());

  useFrame((state, delta) => {
    const lensViewport = state.viewport.getCurrentViewport(state.camera, [0, 0, 15]);
    const targetX = reducedMotion ? 0 : (state.pointer.x * lensViewport.width) / 2;
    const targetY = reducedMotion ? 0 : (state.pointer.y * lensViewport.height) / 2;

    lens.current.position.x = THREE.MathUtils.damp(lens.current.position.x, targetX, 7, delta);
    lens.current.position.y = THREE.MathUtils.damp(lens.current.position.y, targetY, 7, delta);
    lens.current.position.z = 15;

    state.gl.setRenderTarget(buffer);
    if (state.scene.background instanceof THREE.Color) state.gl.setClearColor(state.scene.background);
    state.gl.clear();
    state.gl.render(scene, state.camera);
    state.gl.setRenderTarget(null);
  });

  return (
    <>
      {createPortal(children, scene)}
      <mesh scale={[viewport.width, viewport.height, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={buffer.texture} toneMapped={false} />
      </mesh>
      <mesh
        ref={lens}
        geometry={nodes.Cylinder.geometry}
        rotation-x={Math.PI / 2}
        scale={viewport.width < 5 ? 0.17 : 0.25}
      >
        <MeshTransmissionMaterial
          buffer={buffer.texture}
          ior={1.2}
          thickness={1.5}
          anisotropy={0.1}
          chromaticAberration={0.04}
        />
      </mesh>
    </>
  );
}

function ScrollImage({ url, position, scale, start, zoom = 0.22, reducedMotion = false }: PanelProps) {
  const group = useRef<THREE.Group>(null!);
  const scroll = useScroll();

  useFrame((_, delta) => {
    const progress = reducedMotion ? 0 : scroll.range(start, 0.34);
    const scaleTarget = 1 + progress * zoom;
    const depthTarget = progress * 0.65;

    group.current.scale.x = THREE.MathUtils.damp(group.current.scale.x, scaleTarget, 4, delta);
    group.current.scale.y = THREE.MathUtils.damp(group.current.scale.y, scaleTarget, 4, delta);
    group.current.position.z = THREE.MathUtils.damp(group.current.position.z, position[2] + depthTarget, 4, delta);
  });

  return (
    <group ref={group} position={position}>
      <SceneImage url={url} scale={scale} transparent toneMapped={false} />
    </group>
  );
}

function Images({ reducedMotion }: { reducedMotion: boolean }) {
  const { width, height } = useThree((state) => state.viewport);
  const compact = useThree((state) => state.size.width < 650);

  return (
    <group>
      <ScrollImage
        reducedMotion={reducedMotion}
        url="/activities/sustainability.jpg"
        position={[compact ? 0 : -width * 0.16, 0, 0]}
        scale={[width * (compact ? 0.9 : 0.62), height * 0.84]}
        start={0}
        zoom={0.08}
      />
      {!compact && <ScrollImage
        reducedMotion={reducedMotion}
        url="/activities/collaboration.jpg"
        position={[width * 0.32, -height * 0.05, 0]}
        scale={[width * 0.3, height * 0.65]}
        start={0.03}
        zoom={0.06}
      />}
      <ScrollImage
        reducedMotion={reducedMotion}
        url="/activities/collaboration.jpg"
        position={[0, -height, 0]}
        scale={[width * 0.9, height * 0.85]}
        start={0.3}
        zoom={0.08}
      />
      <ScrollImage
        reducedMotion={reducedMotion}
        url="/activities/sustainability.jpg"
        position={[0, -height * 2, 0]}
        scale={[width * 0.9, height * 0.85]}
        start={0.66}
        zoom={0.08}
      />
    </group>
  );
}

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <ScrollControls pages={3} damping={reducedMotion ? 0 : 0.18} distance={1} style={{ scrollbarWidth: 'thin', scrollbarColor: '#708777 transparent' }}>
      <Lens reducedMotion={reducedMotion}>
        <Scroll>
          <Images reducedMotion={reducedMotion} />
        </Scroll>
        <Preload all />
      </Lens>
    </ScrollControls>
  );
}

function StaticFallback() {
  return (
    <div className="why-lens-fallback">
      <strong>Why KRYAcademia</strong>
      <span>Learning should prepare young people to shape the world.</span>
    </div>
  );
}

export default function WhyKryacademiaLens({ active = true }: { active?: boolean }) {
  const reducedMotion = useReducedMotion();
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="why-lens-experience" role="presentation">
      {!loaded && <div className="scene-poster why-scene-poster">
        <NextImage src="/activities/sustainability.jpg" alt="Students exploring creative coding together" width={1024} height={724} />
        <NextImage src="/activities/collaboration.jpg" alt="A student and educator building a project" width={1500} height={1060} />
      </div>}
      <div className="why-lens-canvas" aria-hidden="true">
        <Canvas
          frameloop={active ? 'always' : 'never'}
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 20], fov: 15 }}
          gl={{ alpha: false, antialias: false, powerPreference: 'high-performance', stencil: false }}
          fallback={<StaticFallback />}
          onCreated={({ gl, scene }) => {
            const background = getComputedStyle(gl.domElement).getPropertyValue('--page-background').trim();
            scene.background = new THREE.Color(background || '#f3f6f3');
            gl.setClearColor(scene.background);
          }}
        >
          <Suspense fallback={null}>
            <Scene reducedMotion={reducedMotion} />
            <SceneReady onReady={setLoaded} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
