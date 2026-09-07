'use client';

import * as THREE from 'three';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Line, Preload, Text } from '@react-three/drei';
import { Box, Flex } from '@react-three/flex';

type Story = {
  tag: string;
  text: string;
  supporting: string;
  images: string[];
};

type ScrollState = {
  top: number;
  max: number;
  velocity: number;
  mouse: [number, number];
};

const stories: Story[] = [
  {
    tag: '00 / WHY KRYACADEMIA',
    text: 'Learning should\nprepare young people\nto shape the world.',
    supporting: 'Not simply fit into it.',
    images: ['/activities/coding.png', '/activities/maker.png', '/activities/ar.png'],
  },
  {
    tag: '01 / BACKGROUND',
    text: 'Purpose grows\nwhen curiosity\nmeets a real challenge.',
    supporting: 'Sustainable development is a creative learning lens.',
    images: ['/activities/sustainability.jpg', '/activities/collaboration.jpg', '/activities/maker.png'],
  },
  {
    tag: '02 / OUR VISION',
    text: 'Thoughtful creators\nfor a future\nworth building.',
    supporting: 'Critical thinking, confidence, and collaboration in practice.',
    images: ['/activities/animation.png', '/activities/anime.png', '/activities/collaboration.jpg'],
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

function StoryImage({
  url,
  index,
  width,
  height,
  scroll,
  reducedMotion,
}: {
  url: string;
  index: number;
  width: number;
  height: number;
  scroll: React.MutableRefObject<ScrollState>;
  reducedMotion: boolean;
}) {
  const texture = useLoader(THREE.TextureLoader, url);
  const group = useRef<THREE.Group>(null!);
  const material = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame((_, delta) => {
    const velocity = reducedMotion ? 0 : Math.min(0.9, Math.abs(scroll.current.velocity) / 280);
    const tilt = reducedMotion ? 0 : (index - 1) * 0.018 + scroll.current.mouse[0] * 0.012;

    group.current.position.z = THREE.MathUtils.damp(group.current.position.z, velocity * (index + 1) * 0.6, 4, delta);
    group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, tilt, 4, delta);
    material.current.opacity = THREE.MathUtils.damp(material.current.opacity, 1 - velocity * 0.2, 4, delta);
  });

  return (
    <group ref={group}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial ref={material} map={texture} transparent toneMapped={false} />
      </mesh>
      <Text
        position={[-width / 2 + 0.14, -height / 2 + 0.14, 0.025]}
        font="/Inter-UI-Medium.ttf"
        fontSize={0.075}
        color="#f5f5f5"
        anchorX="left"
        anchorY="bottom"
      >
        {String(index + 1).padStart(2, '0')}
      </Text>
    </group>
  );
}

function StoryPage({
  story,
  index,
  scroll,
  reducedMotion,
}: {
  story: Story;
  index: number;
  scroll: React.MutableRefObject<ScrollState>;
  reducedMotion: boolean;
}) {
  const { viewport } = useThree();
  const compact = viewport.width < 7;
  const images = compact ? story.images.slice(0, 2) : story.images;
  const imageWidth = compact ? viewport.width * 0.37 : Math.min(viewport.width * 0.23, 2.9);
  const imageHeight = compact ? viewport.height * 0.31 : viewport.height * 0.52;
  const imageGap = compact ? 0.16 : 0.28;
  const pageHeight = compact ? viewport.height * 1.22 : viewport.height * 1.18;
  const textWidth = compact ? viewport.width * 0.84 : viewport.width * 0.55;
  const textHeight = compact ? viewport.height * 0.56 : viewport.height * 0.56;
  const left = index % 2 === 0;
  const typeScale = Math.min(1, Math.max(0.72, viewport.width / 13));

  return (
    <Box dir="column" width={viewport.width} height={pageHeight}>
      <Box dir="row" width={viewport.width} height={imageHeight} justify={left ? 'flex-start' : 'flex-end'} align="center">
        {images.map((url, imageIndex) => (
          <Box
            centerAnchor
            key={url}
            width={imageWidth}
            height={imageHeight * (imageIndex === 1 ? 0.88 : 1)}
            marginLeft={imageIndex === 0 ? imageGap : 0}
            marginRight={imageGap}
          >
            {(width, height) => (
              <StoryImage
                url={url}
                index={imageIndex}
                width={width}
                height={height}
                scroll={scroll}
                reducedMotion={reducedMotion}
              />
            )}
          </Box>
        ))}
      </Box>

      <Box dir="row" width={viewport.width} height={textHeight} justify={left ? 'flex-end' : 'flex-start'} align="center">
        <Box centerAnchor width={textWidth} height={textHeight * 0.82}>
          {(width, height) => {
            const textX = left ? width / 2 - 0.12 : -width / 2 + 0.12;
            const anchor = left ? 'right' : 'left';

            return (
              <>
                <Text
                  position={[textX, height / 2 - 0.06, 0.03]}
                  font="/Inter-UI-Medium.ttf"
                  fontSize={0.095 * typeScale}
                  color="#e8001b"
                  textAlign={anchor}
                  anchorX={anchor}
                  anchorY="top"
                >
                  {story.tag}
                </Text>
                <Text
                  position={[textX, height / 2 - 0.34, 0.03]}
                  font="/Inter-UI-Medium.ttf"
                  fontSize={(compact ? 0.34 : 0.5) * typeScale}
                  maxWidth={width - 0.24}
                  lineHeight={0.93}
                  color="#101010"
                  textAlign={anchor}
                  anchorX={anchor}
                  anchorY="top"
                >
                  {story.text}
                </Text>
                <Text
                  position={[textX, -height / 2 + 0.12, 0.03]}
                  font="/Inter-UI-Medium.ttf"
                  fontSize={0.115 * typeScale}
                  maxWidth={width - 0.24}
                  lineHeight={1.3}
                  color="#5a5a5a"
                  textAlign={anchor}
                  anchorX={anchor}
                  anchorY="bottom"
                >
                  {story.supporting}
                </Text>
              </>
            );
          }}
        </Box>
      </Box>
    </Box>
  );
}

function Interlude({ scroll, reducedMotion }: { scroll: React.MutableRefObject<ScrollState>; reducedMotion: boolean }) {
  const { viewport } = useThree();
  const group = useRef<THREE.Group>(null!);
  const compact = viewport.width < 7;
  const typeScale = Math.min(1, Math.max(0.72, viewport.width / 13));

  useFrame((_, delta) => {
    const target = reducedMotion ? 0 : Math.min(0.35, Math.abs(scroll.current.velocity) / 850);
    group.current.position.z = THREE.MathUtils.damp(group.current.position.z, target, 3, delta);
  });

  return (
    <Box centerAnchor width={viewport.width} height={viewport.height * 0.92}>
      {(width, height) => (
        <group ref={group}>
          <Line points={[[-width / 2, 0, 0], [-width * 0.25, 0, 0]]} color="#e8001b" lineWidth={1.5} />
          <Line points={[[width / 2, 0, 0], [width * 0.25, 0, 0]]} color="#e8001b" lineWidth={1.5} />
          <Text
            position={[0, 0, 0.03]}
            font="/Inter-UI-Medium.ttf"
            fontSize={(compact ? 0.34 : 0.58) * typeScale}
            maxWidth={width * 0.56}
            lineHeight={0.96}
            color="#101010"
            textAlign="center"
            anchorX="center"
            anchorY="middle"
          >
            {'Curiosity becomes\ncapability when\nstudents learn by doing.'}
          </Text>
          <Text
            position={[0, -height * 0.26, 0.03]}
            font="/Inter-UI-Medium.ttf"
            fontSize={0.09 * typeScale}
            color="#e8001b"
            anchorX="center"
            anchorY="middle"
          >
            SDG 4 / SDG 9 / SDG 12 / SDG 17
          </Text>
        </group>
      )}
    </Box>
  );
}

function FinalFrame({
  scroll,
  reducedMotion,
}: {
  scroll: React.MutableRefObject<ScrollState>;
  reducedMotion: boolean;
}) {
  const texture = useLoader(THREE.TextureLoader, '/activities/collaboration.jpg');
  const group = useRef<THREE.Group>(null!);
  const { viewport } = useThree();
  const compact = viewport.width < 7;
  const typeScale = Math.min(1, Math.max(0.72, viewport.width / 13));

  useFrame((_, delta) => {
    const targetX = reducedMotion ? 0 : scroll.current.mouse[0] * 0.14;
    const baseY = compact ? 0.7 : 1.45;
    const targetY = baseY + (reducedMotion ? 0 : scroll.current.mouse[1] * 0.08);
    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, targetX, 3, delta);
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, targetY, 3, delta);
    group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, reducedMotion ? 0 : -scroll.current.mouse[0] * 0.025, 3, delta);
  });

  return (
    <Box centerAnchor width={viewport.width} height={viewport.height * 1.04}>
      {(width, height) => {
        const cardWidth = compact ? width * 0.82 : width * 0.5;
        const cardHeight = compact ? height * 0.58 : height * 0.72;

        return (
          <group ref={group} position={[0, compact ? 0.7 : 1.45, 0]}>
            <mesh position={[0.1, -0.1, -0.06]}>
              <planeGeometry args={[cardWidth, cardHeight]} />
              <meshBasicMaterial color="#e8001b" toneMapped={false} />
            </mesh>
            <mesh>
              <planeGeometry args={[cardWidth, cardHeight]} />
              <meshBasicMaterial map={texture} toneMapped={false} />
            </mesh>
            <mesh position={[0, -cardHeight / 2 + 0.42, 0.025]}>
              <planeGeometry args={[cardWidth, 0.84]} />
              <meshBasicMaterial color="#f5f5f5" transparent opacity={0.94} depthWrite={false} toneMapped={false} />
            </mesh>
            <Text
              position={[-cardWidth / 2 + 0.18, cardHeight / 2 - 0.18, 0.04]}
              font="/Inter-UI-Medium.ttf"
              fontSize={0.09 * typeScale}
              color="#f5f5f5"
              anchorX="left"
              anchorY="top"
            >
              03 / OUR MISSION
            </Text>
            <Text
              position={[-cardWidth / 2 + 0.18, -cardHeight / 2 + 0.68, 0.04]}
              font="/Inter-UI-Medium.ttf"
              fontSize={(compact ? 0.24 : 0.36) * typeScale}
              maxWidth={cardWidth - 0.36}
              lineHeight={0.98}
              color="#101010"
              anchorX="left"
              anchorY="top"
            >
              {'A future\nmade by doing.'}
            </Text>
          </group>
        );
      }}
    </Box>
  );
}

function StoryContent({
  scroll,
  onPages,
  reducedMotion,
}: {
  scroll: React.MutableRefObject<ScrollState>;
  onPages: (pages: number) => void;
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null!);
  const { viewport } = useThree();
  const layoutHeight = useRef(viewport.height * 5.4);

  const handleReflow = useCallback(
    (_width: number, height: number) => {
      if (!Number.isFinite(height) || height <= 0) return;
      layoutHeight.current = Math.max(height, viewport.height * 5.4);
      onPages(layoutHeight.current / viewport.height + 0.4);
    },
    [onPages, viewport.height],
  );

  useEffect(() => {
    onPages(layoutHeight.current / viewport.height + 0.4);
  }, [onPages, viewport.height]);

  useFrame((_, delta) => {
    const progress = scroll.current.top / Math.max(1, scroll.current.max);
    const travel = Math.max(0, layoutHeight.current - viewport.height);
    const targetY = progress * travel;
    const targetZ = reducedMotion ? 0 : Math.max(0, progress - 0.78) * 1.6;

    group.current.position.y = reducedMotion ? targetY : THREE.MathUtils.damp(group.current.position.y, targetY, 4, delta);
    group.current.position.z = reducedMotion ? targetZ : THREE.MathUtils.damp(group.current.position.z, targetZ, 3, delta);
  });

  return (
    <group ref={group}>
      <Flex
        dir="column"
        position={[-viewport.width / 2, viewport.height / 2, 0]}
        size={[viewport.width, viewport.height, 0]}
        onReflow={handleReflow}
      >
        {stories.map((story, index) => (
          <StoryPage key={story.tag} story={story} index={index} scroll={scroll} reducedMotion={reducedMotion} />
        ))}
        <Interlude scroll={scroll} reducedMotion={reducedMotion} />
        <FinalFrame scroll={scroll} reducedMotion={reducedMotion} />
      </Flex>
    </group>
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
  const scrollArea = useRef<HTMLDivElement>(null!);
  const scroll = useRef<ScrollState>({ top: 0, max: 1, velocity: 0, mouse: [0, 0] });
  const velocityReset = useRef<number | undefined>(undefined);
  const [pages, setPages] = useState(6);

  useEffect(
    () => () => {
      if (velocityReset.current) window.clearTimeout(velocityReset.current);
    },
    [],
  );

  const setPageCount = useCallback((next: number) => {
    const bounded = Math.max(2, Math.min(10, next));
    setPages((current) => (Math.abs(current - bounded) > 0.05 ? bounded : current));
  }, []);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const top = target.scrollTop;
    scroll.current.velocity = top - scroll.current.top;
    scroll.current.top = top;
    scroll.current.max = Math.max(1, target.scrollHeight - target.clientHeight);
    if (velocityReset.current) window.clearTimeout(velocityReset.current);
    velocityReset.current = window.setTimeout(() => {
      scroll.current.velocity = 0;
    }, 96);
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    scroll.current.mouse = [
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    ];
  }, []);

  return (
    <div className="why-yoga-experience" role="presentation">
      <div className="why-yoga-canvas" aria-hidden="true">
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 6], far: 100, fov: 50 }}
          gl={{ alpha: false, antialias: false, powerPreference: 'high-performance', stencil: false }}
          fallback={<StaticFallback />}
          onCreated={({ gl }) => gl.setClearColor('#f5f5f5')}
        >
          <Suspense fallback={null}>
            <StoryContent scroll={scroll} onPages={setPageCount} reducedMotion={reducedMotion} />
            <Preload all />
          </Suspense>
        </Canvas>
      </div>
      <div
        ref={scrollArea}
        className="why-yoga-scroll"
        aria-hidden="true"
        onScroll={handleScroll}
        onPointerMove={handlePointerMove}
      >
        <div className="why-yoga-scroll-spacer" style={{ height: `${Math.ceil(pages * 100)}%` }} />
      </div>
    </div>
  );
}
