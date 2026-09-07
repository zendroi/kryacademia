'use client';

import * as THREE from 'three';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import NextImage from 'next/image';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Image as DreiImage, Preload, Scroll, ScrollControls, useScroll } from '@react-three/drei';
import { activities } from './mockData';

const CARDS_PER_PAGE = 3;
const PAGE_COUNT = Math.ceil(activities.length / CARDS_PER_PAGE);

type GalleryItem = {
  index: number;
  title: string;
  url: string;
};

type ImageMaterial = THREE.ShaderMaterial & {
  grayscale: number;
  zoom: number;
};

const galleryItems: GalleryItem[] = activities.map(([title, url], index) => ({ index, title, url }));
const galleryPages: GalleryItem[][] = Array.from({ length: PAGE_COUNT }, (_, pageIndex) =>
  Array.from({ length: CARDS_PER_PAGE }, (_, slotIndex) => galleryItems[(pageIndex * CARDS_PER_PAGE + slotIndex) % galleryItems.length]),
);

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

function ActivityImage({
  item,
  position,
  scale,
  reducedMotion,
}: {
  item: GalleryItem;
  position: [number, number, number];
  scale: [number, number];
  reducedMotion: boolean;
}) {
  const image = useRef<THREE.Mesh>(null!);
  const group = useRef<THREE.Group>(null!);
  const scroll = useScroll();
  const baseZ = position[2];

  useFrame((_, delta) => {
    const material = image.current.material as ImageMaterial;
    const velocity = reducedMotion ? 0 : scroll.delta;

    group.current.position.z = THREE.MathUtils.damp(
      group.current.position.z,
      baseZ + Math.min(velocity * 75, 1.15),
      4,
      delta,
    );
    material.grayscale = THREE.MathUtils.damp(
      material.grayscale,
      reducedMotion ? 0.12 : Math.max(0.04, 0.72 - velocity * 900),
      4,
      delta,
    );
    material.zoom = THREE.MathUtils.damp(material.zoom, 1.08 + Math.min(velocity * 20, 0.12), 4, delta);
  });

  return (
    <group ref={group} position={position}>
      <DreiImage
        ref={image}
        url={item.url}
        scale={scale}
        radius={0.075}
        grayscale={0.72}
        zoom={1.08}
        toneMapped={false}
      />
    </group>
  );
}

function ActivityPage({ items, position, reducedMotion }: { items: GalleryItem[]; position: number; reducedMotion: boolean }) {
  const { width, height } = useThree((state) => state.viewport);
  const compact = width < 7;
  const spacing = width * (compact ? 0.48 : 0.335);
  const cardWidth = Math.max(1.15, spacing - (compact ? 0.22 : 0.42));
  const cardHeight = Math.min(4.75, height * (compact ? 0.78 : 0.82));
  const verticalOffsets = compact ? [0.34, -0.22, 0.18] : [0.42, -0.3, 0.22];
  const depthOffsets = [-0.55, 0.1, 0.62];

  return (
    <group position={[width * position, 0, 0]}>
      {items.map((item, slotIndex) => (
        <ActivityImage
          key={`${position}-${slotIndex}-${item.index}`}
          item={item}
          position={[(slotIndex - 1) * spacing, verticalOffsets[slotIndex], depthOffsets[slotIndex]]}
          scale={[cardWidth, cardHeight]}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}

function ActivityPages({ reducedMotion }: { reducedMotion: boolean }) {
  const positions = Array.from({ length: PAGE_COUNT * 2 + 2 }, (_, index) => index - 1);

  return (
    <>
      {positions.map((position) => {
        const pageIndex = ((position % PAGE_COUNT) + PAGE_COUNT) % PAGE_COUNT;
        return <ActivityPage key={position} position={position} items={galleryPages[pageIndex]} reducedMotion={reducedMotion} />;
      })}
    </>
  );
}

function PageObserver({ onPageChange }: { onPageChange: (page: number) => void }) {
  const scroll = useScroll();
  const previousPage = useRef(-1);

  useFrame(() => {
    const loopedOffset = ((scroll.offset % 1) + 1) % 1;
    const nextPage = Math.round(loopedOffset * PAGE_COUNT) % PAGE_COUNT;
    if (nextPage !== previousPage.current) {
      previousPage.current = nextPage;
      onPageChange(nextPage);
    }
  });

  return null;
}

function FallbackGallery() {
  return (
    <div className="activities-fallback">
      {galleryPages[0].map((item) => (
        <figure key={item.index}>
          <NextImage src={item.url} alt={item.title} width={900} height={1200} />
        </figure>
      ))}
    </div>
  );
}

export default function ActivitiesInfiniteScroll() {
  const [activePage, setActivePage] = useState(0);
  const reducedMotion = useReducedMotion();
  const visibleItems = useMemo(() => galleryPages[activePage], [activePage]);

  return (
    <div className="activities-gallery" role="region" aria-label="KRYAcademia activity gallery">
      <div className="activities-canvas" aria-hidden="true">
        <Canvas
          camera={{ position: [0, 0, 6], fov: 52 }}
          dpr={[1, 1.5]}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          fallback={<FallbackGallery />}
        >
          <color attach="background" args={['#0b192c']} />
          <Suspense fallback={null}>
            <ScrollControls
              infinite
              horizontal
              pages={PAGE_COUNT + 1}
              distance={1}
              damping={reducedMotion ? 0.01 : 0.22}
              style={{ scrollbarWidth: 'none', overscrollBehavior: 'contain', touchAction: 'pan-x pan-y' }}
            >
              <Scroll>
                <ActivityPages reducedMotion={reducedMotion} />
              </Scroll>
              <PageObserver onPageChange={setActivePage} />
            </ScrollControls>
            <Preload all />
          </Suspense>
        </Canvas>
      </div>

      <div className="activities-gallery-legend" aria-live="polite">
        {visibleItems.map((item) => (
          <div key={`${activePage}-${item.index}`}>
            <small>{String(item.index + 1).padStart(2, '0')}</small>
            <strong>{item.title}</strong>
          </div>
        ))}
      </div>

      <ol className="sr-only">
        {galleryItems.map((item) => (
          <li key={item.index}>{item.title}</li>
        ))}
      </ol>
    </div>
  );
}
