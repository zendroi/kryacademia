'use client';

import * as THREE from 'three';
import { Suspense, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import NextImage from 'next/image';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Image as DreiImage, Preload } from '@react-three/drei';
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaCarouselType } from 'embla-carousel';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { activities } from './mockData';

type ImageMaterial = THREE.ShaderMaterial & { grayscale: number; zoom: number };

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

function ActivityImage({ index, url, carousel }: { index: number; url: string; carousel: EmblaCarouselType }) {
  const image = useRef<THREE.Mesh>(null!);
  const group = useRef<THREE.Group>(null!);
  const previous = useRef(0);
  const { width, height } = useThree((state) => state.viewport);
  const compact = useThree((state) => state.size.width <= 720);
  const spacing = width / (compact ? 1 : 3);
  const length = spacing * activities.length;
  const cardWidth = compact ? width * 0.84 : spacing - 0.42;
  const cardHeight = Math.min(4.75, height * (compact ? 0.78 : 0.82));
  const baseZ = compact ? 0 : [-0.55, 0.1, 0.62][index % 3];

  useFrame((_, delta) => {
    const progress = carousel.scrollProgress();
    const velocity = Math.abs(THREE.MathUtils.euclideanModulo(progress - previous.current + 0.5, 1) - 0.5);
    previous.current = progress;
    // Embla owns the continuous loop; wrap the matching WebGL plane only when offscreen.
    const left = -width / 2 - spacing;
    const baseX = (index + 0.5) * spacing - width / 2;
    group.current.position.x = THREE.MathUtils.euclideanModulo(baseX - progress * length - left, length) + left;
    group.current.position.z = THREE.MathUtils.damp(group.current.position.z, baseZ + Math.min(velocity * 75, 1.15), 4, delta);
    const material = image.current.material as ImageMaterial;
    material.grayscale = THREE.MathUtils.damp(material.grayscale, Math.max(0, 0.15 - velocity * 900), 4, delta);
    material.zoom = THREE.MathUtils.damp(material.zoom, 1.08 + Math.min(velocity * 20, 0.12), 4, delta);
  });

  return (
    <group ref={group} position={[0, compact ? 0.12 : [0.42, -0.3, 0.22][index % 3], baseZ]}>
      <DreiImage ref={image} url={url} scale={[cardWidth, cardHeight]} radius={0.075} grayscale={0.15} zoom={1.08} toneMapped={false} />
    </group>
  );
}

function GalleryScene({ carousel, onReady }: { carousel: EmblaCarouselType; onReady: (ready: boolean) => void }) {
  useEffect(() => {
    onReady(true);
    return () => onReady(false);
  }, [onReady]);
  return (
    <>
      {activities.map(([, url], index) => <ActivityImage key={url} index={index} url={url} carousel={carousel} />)}
      <Preload all />
    </>
  );
}

export default function ActivitiesInfiniteScroll() {
  const reducedMotion = useReducedMotion();
  const [carouselRef, carousel] = useEmblaCarousel(
    { loop: true, align: 'start', dragFree: true, duration: reducedMotion ? 0 : 28 },
    [WheelGesturesPlugin()],
  );
  const galleryRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: '150px' });
    if (galleryRef.current) observer.observe(galleryRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!carousel) return;
    const onSelect = () => setSelected(carousel.selectedScrollSnap());
    onSelect();
    carousel.on('select', onSelect).on('reInit', onSelect);
    return () => { carousel.off('select', onSelect).off('reInit', onSelect); };
  }, [carousel]);

  const showCanvas = ready && !reducedMotion;
  return (
    <div className="activities-gallery" ref={galleryRef} role="region" aria-roledescription="carousel" aria-label="KRYAcademia activity gallery" data-active-index={selected}>
      <div
        className={`activities-carousel${showCanvas ? ' has-canvas' : ''}`}
        ref={carouselRef}
        tabIndex={0}
        aria-label="Activity photos"
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            if (event.key === 'ArrowLeft') carousel?.scrollPrev(reducedMotion);
            else carousel?.scrollNext(reducedMotion);
          }
        }}
      >
        <div className="activities-track">
          {activities.map(([title, url], index) => (
            <figure className="activity-slide" key={url} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${activities.length}`}>
              <NextImage src={url} alt={title} width={900} height={1200} draggable={false} />
            </figure>
          ))}
        </div>
      </div>
      {!reducedMotion && carousel && (
        <div className="activities-canvas" aria-hidden="true" style={{ opacity: showCanvas ? 1 : 0 }}>
          <Canvas style={{ pointerEvents: 'none' }} camera={{ position: [0, 0, 6], fov: 52 }} dpr={[1, 1.5]} frameloop={inView ? 'always' : 'never'}
            gl={{ antialias: false, powerPreference: 'high-performance' }} fallback={null}>
            <color attach="background" args={['#0b192c']} />
            <Suspense fallback={null}><GalleryScene carousel={carousel} onReady={setReady} /></Suspense>
          </Canvas>
        </div>
      )}
      <div className="gallery-controls">
        <button type="button" onClick={() => carousel?.scrollPrev(reducedMotion)} aria-label="Previous activity photos" title="Previous photos"><ChevronLeft size={20} /></button>
        <button type="button" onClick={() => carousel?.scrollNext(reducedMotion)} aria-label="Next activity photos" title="Next photos"><ChevronRight size={20} /></button>
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">Photo {selected + 1} of {activities.length}</span>
    </div>
  );
}
