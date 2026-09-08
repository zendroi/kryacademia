'use client';

import * as THREE from 'three';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber';
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

  return (
    <group>
      <ScrollImage
        reducedMotion={reducedMotion}
        url="/activities/collaboration.jpg"
        position={[0, 0, 0]}
        scale={[width * 0.88, height * 0.86]}
        start={0}
        zoom={0.11}
      />
      <ScrollImage
        reducedMotion={reducedMotion}
        url="/activities/coding.png"
        position={[width * 0.28, height * 0.1, 3]}
        scale={[width * 0.28, height * 0.53]}
        start={0.03}
      />
      <ScrollImage
        reducedMotion={reducedMotion}
        url="/activities/maker.png"
        position={[-width * 0.28, -height * 0.76, 4]}
        scale={[width * 0.28, height * 0.62]}
        start={0.31}
      />
      <ScrollImage
        reducedMotion={reducedMotion}
        url="/activities/sustainability.jpg"
        position={[-width * 0.02, -height * 0.76, 7]}
        scale={[width * 0.28, height * 0.43]}
        start={0.35}
      />
      <ScrollImage
        reducedMotion={reducedMotion}
        url="/activities/animation.png"
        position={[width * 0.29, -height * 0.76, 9]}
        scale={[width * 0.28, height * 0.62]}
        start={0.39}
      />
      <ScrollImage
        reducedMotion={reducedMotion}
        url="/activities/ar.png"
        position={[0, -height * 1.26, 5]}
        scale={[width * 0.46, height * 0.76]}
        start={0.61}
        zoom={0.16}
      />
      <ScrollImage
        reducedMotion={reducedMotion}
        url="/activities/sustainability.jpg"
        position={[0, -height * 1.76, 0]}
        scale={[width * 0.88, height * 0.74]}
        start={0.72}
        zoom={0.1}
      />
    </group>
  );
}

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <ScrollControls pages={3} damping={reducedMotion ? 0 : 0.18} distance={0.62} style={{ scrollbarWidth: 'thin', scrollbarColor: '#173051 transparent' }}>
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

export default function WhyKryacademiaLens() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="why-lens-experience" role="presentation">
      <div className="why-lens-canvas" aria-hidden="true">
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 20], fov: 15 }}
          gl={{ alpha: false, antialias: false, powerPreference: 'high-performance', stencil: false }}
          fallback={<StaticFallback />}
          onCreated={({ gl, scene }) => {
            const background = getComputedStyle(gl.domElement).getPropertyValue('--page-background').trim();
            scene.background = new THREE.Color(background || '#faf9f5');
            gl.setClearColor(scene.background);
          }}
        >
          <Suspense fallback={null}>
            <Scene reducedMotion={reducedMotion} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
