'use client';

import * as THREE from 'three';
import { Suspense, useEffect, useRef, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import NextImage from 'next/image';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Image as DreiImage, Preload, Scroll, ScrollControls, useScroll } from '@react-three/drei';
import { activities } from './mockData';

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
      reducedMotion ? 0 : Math.max(0, 0.15 - velocity * 900),
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
        grayscale={0.15}
        zoom={1.08}
        toneMapped={false}
      />
    </group>
  );
}

function ActivityPage({ items, position, reducedMotion }: { items: GalleryItem[]; position: number; reducedMotion: boolean }) {
  const { width, height } = useThree((state) => state.viewport);
  const compact = items.length === 1;
  const spacing = width * 0.335;
  const cardWidth = compact ? width * 0.84 : Math.max(1.15, spacing - 0.42);
  const cardHeight = Math.min(4.75, height * (compact ? 0.78 : 0.82));
  const verticalOffsets = compact ? [0.34, -0.22, 0.18] : [0.42, -0.3, 0.22];
  const depthOffsets = [-0.55, 0.1, 0.62];

  return (
    <group position={[width * position, 0, 0]}>
      {items.map((item, slotIndex) => (
        <ActivityImage
          key={`${position}-${slotIndex}-${item.index}`}
          item={item}
          position={[compact ? 0 : (slotIndex - 1) * spacing, compact ? 0.12 : verticalOffsets[slotIndex], compact ? 0 : depthOffsets[slotIndex]]}
          scale={[cardWidth, cardHeight]}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}

function ActivityPages({ reducedMotion, columns }: { reducedMotion: boolean; columns: number }) {
  const pageCount = Math.ceil(galleryItems.length / columns);
  const positions = Array.from({ length: pageCount * 2 + 2 }, (_, index) => index - 1);

  return (
    <>
      {positions.map((position) => {
        const pageIndex = ((position % pageCount) + pageCount) % pageCount;
        const items = Array.from({ length: columns }, (_, slot) => galleryItems[(pageIndex * columns + slot) % galleryItems.length]);
        return <ActivityPage key={position} position={position} items={items} reducedMotion={reducedMotion} />;
      })}
    </>
  );
}

function FallbackGallery({ scrollRef }: { scrollRef?: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="activities-fallback" ref={scrollRef}>
      {galleryItems.map((item) => (
        <figure key={item.index}>
          <NextImage src={item.url} alt={item.title} width={900} height={1200} />
        </figure>
      ))}
    </div>
  );
}

function GalleryScroll({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const { el } = useScroll();
  useEffect(() => {
    scrollRef.current = el;
    // Drei converts vertical wheel input to horizontal; leave vertical gestures to the page.
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && !event.shiftKey) event.stopImmediatePropagation();
    };
    el.addEventListener('wheel', onWheel, { capture: true, passive: true });
    return () => { el.removeEventListener('wheel', onWheel, true); scrollRef.current = null; };
  }, [el, scrollRef]);
  return null;
}

function GalleryScene({ reducedMotion, scrollRef }: { reducedMotion: boolean; scrollRef: RefObject<HTMLDivElement | null> }) {
  const columns = useThree((state) => state.size.width < 720 ? 1 : 3);
  const pageCount = Math.ceil(galleryItems.length / columns);
  return (
    <>
      <ScrollControls key={columns} infinite horizontal pages={pageCount + 1} distance={1} damping={reducedMotion ? 0.01 : 0.22}
        style={{ scrollbarWidth: 'none', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'auto', touchAction: 'pan-x pan-y' }}>
        <GalleryScroll scrollRef={scrollRef} />
        <Scroll><ActivityPages reducedMotion={reducedMotion} columns={columns} /></Scroll>
      </ScrollControls>
      <Preload all />
    </>
  );
}

export default function ActivitiesInfiniteScroll() {
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: '150px' });
    if (galleryRef.current) observer.observe(galleryRef.current);
    return () => observer.disconnect();
  }, []);
  const move = (direction: number) => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: reducedMotion ? 'instant' : 'smooth' });
  };

  return (
    <div className="activities-gallery" ref={galleryRef} role="region" aria-label="KRYAcademia activity gallery">
      {reducedMotion ? <FallbackGallery scrollRef={scrollRef} /> : (
      <div className="activities-canvas" aria-hidden="true">
        <Canvas
          camera={{ position: [0, 0, 6], fov: 52 }}
          dpr={[1, 1.5]}
          frameloop={inView ? 'always' : 'never'}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          fallback={<FallbackGallery scrollRef={scrollRef} />}
        >
          <color attach="background" args={['#0b192c']} />
          <Suspense fallback={null}>
            <GalleryScene reducedMotion={reducedMotion} scrollRef={scrollRef} />
          </Suspense>
        </Canvas>
      </div>
      )}
      <div className="gallery-controls">
        <button type="button" onClick={() => move(-1)} aria-label="Previous activity photos" title="Previous photos"><ChevronLeft size={20} /></button>
        <button type="button" onClick={() => move(1)} aria-label="Next activity photos" title="Next photos"><ChevronRight size={20} /></button>
      </div>

      <ol className="sr-only">
        {galleryItems.map((item) => (
          <li key={item.index}>{item.title}</li>
        ))}
      </ol>
    </div>
  );
}
