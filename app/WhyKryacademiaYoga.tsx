'use client';

import * as THREE from 'three';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Image as DreiImage, Preload, Text } from '@react-three/drei';
import { Box, Flex } from '@react-three/flex';

type Pillar = {
  number: string;
  title: string;
  copy: string;
  color: string;
  ink: string;
};

const pillars: Pillar[] = [
  {
    number: '01',
    title: 'Background',
    copy: 'Sustainable development becomes a creative learning lens.',
    color: '#f4efe4',
    ink: '#10243f',
  },
  {
    number: '02',
    title: 'Our vision',
    copy: 'Thoughtful creators for a sustainable future.',
    color: '#d8ebef',
    ink: '#10243f',
  },
  {
    number: '03',
    title: 'Our mission',
    copy: 'Project learning builds confidence and collaboration.',
    color: '#e9384d',
    ink: '#ffffff',
  },
];

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

function useCompactCanvas() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return compact;
}

function FloatingPhoto({ width, height, compact, reducedMotion }: { width: number; height: number; compact: boolean; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const captionHeight = Math.min(compact ? 0.76 : 0.94, height * 0.24);
  const inset = compact ? 0.12 : 0.18;

  useFrame(({ clock, pointer }) => {
    if (reducedMotion) return;

    const time = clock.getElapsedTime();
    group.current.position.y = Math.sin(time * 0.72) * 0.055;
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, pointer.x * 0.025, 0.04);
  });

  return (
    <group ref={group}>
      <mesh position={[0, 0, -0.025]}>
        <planeGeometry args={[width + inset, height + inset]} />
        <meshBasicMaterial color="#ff5d6f" toneMapped={false} />
      </mesh>
      <DreiImage
        url="/activities/sustainability.jpg"
        scale={[width, height]}
        radius={0.045}
        zoom={1.05}
        toneMapped={false}
      />
      <mesh position={[0, -height / 2 + captionHeight / 2, 0.025]}>
        <planeGeometry args={[width, captionHeight]} />
        <meshBasicMaterial color="#081a31" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </mesh>
      <Text
        position={[-width / 2 + inset, -height / 2 + captionHeight - inset, 0.04]}
        font="/Inter-UI-Medium.ttf"
        fontSize={compact ? 0.105 : 0.13}
        maxWidth={width - inset * 2}
        lineHeight={1.15}
        color="#ffffff"
        anchorX="left"
        anchorY="top"
      >
        {'Global citizenship\nstarts with curiosity.'}
      </Text>
      <Text
        position={[-width / 2 + inset, height / 2 - inset, 0.04]}
        font="/Inter-UI-Medium.ttf"
        fontSize={compact ? 0.075 : 0.09}
        color="#ffb9c2"
        anchorX="left"
        anchorY="top"
      >
        LEARNING IN ACTION
      </Text>
    </group>
  );
}

function PillarCard({ pillar, compact, width, height }: { pillar: Pillar; compact: boolean; width: number; height: number }) {
  return (
    <Box centerAnchor width={width} height={height}>
      {(width, height) => {
        const inset = compact ? 0.14 : 0.16;
        const titleSize = compact ? 0.15 : 0.16;
        const copySize = compact ? 0.075 : 0.082;
        const titleOffset = compact ? 0.22 : 0.2;

        return (
          <>
            <mesh>
              <planeGeometry args={[width, height]} />
              <meshBasicMaterial color={pillar.color} toneMapped={false} />
            </mesh>
            <Text
              position={[-width / 2 + inset, height / 2 - inset, 0.03]}
              font="/Inter-UI-Medium.ttf"
              fontSize={0.09}
              color={pillar.ink === '#ffffff' ? '#ffd1d7' : '#e8001b'}
              anchorX="left"
              anchorY="top"
            >
              {pillar.number}
            </Text>
            <Text
              position={[-width / 2 + inset, height / 2 - inset - titleOffset, 0.03]}
              font="/Inter-UI-Medium.ttf"
              fontSize={titleSize}
              maxWidth={width - inset * 2}
              color={pillar.ink}
              anchorX="left"
              anchorY="top"
            >
              {pillar.title}
            </Text>
            <Text
              position={[-width / 2 + inset, -height / 2 + inset, 0.03]}
              font="/Inter-UI-Medium.ttf"
              fontSize={copySize}
              maxWidth={width - inset * 2}
              lineHeight={1.28}
              color={pillar.ink === '#ffffff' ? '#fff6f7' : '#3b4f63'}
              anchorX="left"
              anchorY="bottom"
            >
              {pillar.copy}
            </Text>
          </>
        );
      }}
    </Box>
  );
}

function WhyScene({ reducedMotion }: { reducedMotion: boolean }) {
  const { viewport } = useThree();
  const compact = viewport.width < 7;
  const padding = compact ? 0.18 : 0.28;
  const typeScale = Math.min(1, Math.max(0.72, viewport.width / 13));
  const headerHeight = compact ? 0.34 : 0.4;
  const cardsHeight = compact ? 2.9 : 0.98;
  const gap = compact ? 0.12 : 0.18;
  const contentWidth = viewport.width - padding * 2;
  const mainHeight = Math.max(1.2, viewport.height - padding * 2 - headerHeight - cardsHeight - gap * 2);
  const heroHeight = compact ? mainHeight * 0.54 : mainHeight;
  const photoHeight = compact ? mainHeight - heroHeight : mainHeight;
  const cardWidth = compact ? contentWidth : (contentWidth - gap * 2) / 3;
  const cardHeight = compact ? 0.84 : cardsHeight;

  return (
    <Flex
      dir="column"
      position={[-viewport.width / 2, viewport.height / 2, 0]}
      size={[viewport.width, viewport.height, 0]}
      padding={padding}
    >
      <Box dir="row" width={contentWidth} height={headerHeight} justify="space-between" marginBottom={gap}>
        <Box centerAnchor width={contentWidth * 0.54} height={headerHeight}>
          {(width, height) => (
            <Text
              position={[-width / 2, height / 2, 0.04]}
              font="/Inter-UI-Medium.ttf"
              fontSize={0.105}
              color="#ff9da9"
              anchorX="left"
              anchorY="top"
            >
              WHY KRYACADEMIA
            </Text>
          )}
        </Box>
        <Box centerAnchor width={contentWidth * 0.42} height={headerHeight}>
          {(width, height) => (
            <Text
              position={[width / 2, height / 2, 0.04]}
              font="/Inter-UI-Medium.ttf"
              fontSize={compact ? 0.07 : 0.09}
              color="#c9dde9"
              textAlign="right"
              anchorX="right"
              anchorY="top"
            >
              SDG 4 / 9 / 12 / 17
            </Text>
          )}
        </Box>
      </Box>

      <Box
        dir={compact ? 'column' : 'row'}
        width={contentWidth}
        height={mainHeight}
        justify="space-between"
        align="stretch"
        marginBottom={gap}
      >
        <Box centerAnchor width={compact ? contentWidth : contentWidth * 0.515} height={heroHeight}>
          {(width, height) => (
            <>
              <mesh position={[0, 0, -0.02]}>
                <planeGeometry args={[width, height]} />
                <meshBasicMaterial color="#102d4d" toneMapped={false} />
              </mesh>
              <mesh position={[-width / 2 + 0.08, 0, 0]}>
                <planeGeometry args={[0.08, height]} />
                <meshBasicMaterial color="#e8001b" toneMapped={false} />
              </mesh>
              <Text
                position={[-width / 2 + 0.28, height / 2 - 0.28, 0.035]}
                font="/Inter-UI-Medium.ttf"
                fontSize={0.085 * typeScale}
                color="#ff9da9"
                anchorX="left"
                anchorY="top"
              >
                CREATE WITH PURPOSE
              </Text>
              <Text
                position={[-width / 2 + 0.28, height / 2 - (compact ? 1.2 : 0.62), 0.035]}
                font="/Inter-UI-Medium.ttf"
                fontSize={(compact ? 0.29 : 0.42) * typeScale}
                maxWidth={width - 0.56}
                lineHeight={0.98}
                color="#f8f2e9"
                anchorX="left"
                anchorY="top"
              >
                {'Learning should prepare young people to shape the world,\nnot simply fit into it.'}
              </Text>
              <Text
                position={[-width / 2 + 0.28, -height / 2 + 0.3, 0.035]}
                font="/Inter-UI-Medium.ttf"
                fontSize={0.105 * typeScale}
                maxWidth={width - 0.56}
                lineHeight={1.28}
                color="#c5d7e5"
                anchorX="left"
                anchorY="bottom"
              >
                {'Real projects build the confidence to question, collaborate,\nand make a meaningful impact.'}
              </Text>
            </>
          )}
        </Box>

        <Box centerAnchor width={compact ? contentWidth : contentWidth * 0.435} height={photoHeight}>
          {(width, height) => <FloatingPhoto width={width} height={height} compact={compact} reducedMotion={reducedMotion} />}
        </Box>
      </Box>

      <Box dir={compact ? 'column' : 'row'} width={contentWidth} height={cardsHeight} justify="space-between">
        {pillars.map((pillar) => (
          <PillarCard key={pillar.number} pillar={pillar} compact={compact} width={cardWidth} height={cardHeight} />
        ))}
      </Box>
    </Flex>
  );
}

function StaticFallback() {
  return (
    <div className="why-yoga-fallback">
      <strong>Why KRYAcademia</strong>
      <span>Learning should prepare young people to shape the world.</span>
    </div>
  );
}

export default function WhyKryacademiaYoga() {
  const reducedMotion = useReducedMotion();
  const compactCanvas = useCompactCanvas();

  return (
    <div className="why-yoga-canvas" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, compactCanvas ? 10 : 6], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        fallback={<StaticFallback />}
      >
        <color attach="background" args={['#081a31']} />
        <Suspense fallback={null}>
          <WhyScene reducedMotion={reducedMotion} />
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}
